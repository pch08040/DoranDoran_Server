import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { DomainException } from 'src/common/exception/domain.exception';
import { UserReportModel } from './entities/user-report.entity';
import { UserBlockModel } from './entities/user-block.entity';
import {
    REPORT_REASON_LABELS,
    REPORT_REVIEW_THRESHOLD,
    REPORT_WARNING_THRESHOLD,
    ReportReason,
} from './const/report-reason.const';

@Injectable()
export class ModerationService {
    private readonly logger = new Logger(ModerationService.name);

    constructor(
        @InjectRepository(UserReportModel)
        private readonly reportRepository: Repository<UserReportModel>,
        @InjectRepository(UserBlockModel)
        private readonly blockRepository: Repository<UserBlockModel>,
    ) { }

    // ── 신고 ──────────────────────────────────────────────────

    /** 신고를 접수한다. (기획서 FE-Report-001) */
    async report(reporterId: number, reportedId: number, reason: ReportReason) {
        if (reporterId === reportedId) {
            throw new DomainException('VALIDATION_FAILED', '자기 자신은 신고할 수 없어요.');
        }

        const already = await this.reportRepository.findOne({
            where: { reporter: { id: reporterId }, reported: { id: reportedId } },
        });

        if (already) {
            throw new DomainException('ALREADY_REPORTED');
        }

        await this.reportRepository.save(
            this.reportRepository.create({
                reporter: { id: reporterId },
                reported: { id: reportedId },
                reason,
            }),
        );

        // 누적 횟수를 세어 로그로 남긴다.
        //
        // ⚠️ 여기서 계정을 자동으로 막지 않는다. (2026-08-25 결정)
        //   자동 제재는 악용된다. 세 명이 담합하면 무고한 사람을 쫓아낼 수 있고
        //   되돌릴 창구도 없다. 지금은 '검토가 필요하다'는 사실만 남긴다.
        //   실제 경고 발송은 알림 기능을 만드는 Phase 8 에서 붙인다.
        const total = await this.countReportsAgainst(reportedId);

        if (total >= REPORT_REVIEW_THRESHOLD) {
            this.logger.warn(
                `[검토 필요] userId=${reportedId} 누적 신고 ${total}회 ` +
                `(최근 사유: ${REPORT_REASON_LABELS[reason]})`,
            );
        } else if (total >= REPORT_WARNING_THRESHOLD) {
            this.logger.log(`[경고 대상] userId=${reportedId} 누적 신고 ${total}회`);
        }

        return {
            message: '신고가 성공적으로 접수 되었습니다!',
            reportCount: total,
        };
    }

    /** 그 사람이 받은 누적 신고 수 */
    async countReportsAgainst(userId: number) {
        return this.reportRepository.count({ where: { reported: { id: userId } } });
    }

    // ── 차단 ──────────────────────────────────────────────────

    /** 차단한다. (기획서 FE-Block-001) */
    async block(blockerId: number, blockedId: number) {
        if (blockerId === blockedId) {
            throw new DomainException('VALIDATION_FAILED', '자기 자신은 차단할 수 없어요.');
        }

        const already = await this.blockRepository.findOne({
            where: { blocker: { id: blockerId }, blocked: { id: blockedId } },
        });

        // 이미 차단한 사람을 또 차단하는 건 오류가 아니다.
        // 사용자가 원한 결과('안 보이게')는 이미 이뤄져 있으므로 그대로 성공으로 친다.
        if (already) return { message: '이미 차단한 회원이에요.' };

        await this.blockRepository.save(
            this.blockRepository.create({
                blocker: { id: blockerId },
                blocked: { id: blockedId },
            }),
        );

        return { message: '차단되었습니다.' };
    }

    /** 차단을 푼다. */
    async unblock(blockerId: number, blockedId: number) {
        const result = await this.blockRepository.delete({
            blocker: { id: blockerId },
            blocked: { id: blockedId },
        });

        if (!result.affected) {
            throw new DomainException('NOT_FOUND', '차단한 적이 없는 회원이에요.');
        }

        return { message: '차단을 해제했습니다.' };
    }

    /** 내가 차단한 회원 목록. (시안: 차단한 회원.png) */
    async getBlockedUsers(blockerId: number) {
        const blocks = await this.blockRepository.find({
            where: { blocker: { id: blockerId } },
            relations: ['blocked', 'blocked.images'],
            order: { createdAt: 'DESC' },
        });

        return blocks.map((b) => ({
            id: b.blocked.id,
            firstName: b.blocked.firstName,
            lastName: b.blocked.lastName,
            gender: b.blocked.gender,
            age: b.blocked.age,
            area: b.blocked.area,
            bio: b.blocked.bio,
            images: b.blocked.images,
            blockedAt: b.createdAt,
        }));
    }

    /**
     * 나와 서로 안 보여야 하는 사람들의 id 목록. (기획서 BE-Block-001)
     *
     * **양쪽을 다 모은다.** 내가 차단한 사람 + 나를 차단한 사람.
     * 한쪽만 빼면 이런 일이 생긴다.
     *   A가 B를 차단 → A의 목록에서 B는 사라진다
     *   그런데 B의 목록에는 A가 그대로 남아 A에게 말을 걸 수 있다
     * 차단의 목적이 '괴롭힘을 끊는 것'이므로 양쪽 다 막아야 한다.
     */
    async getHiddenUserIds(userId: number): Promise<number[]> {
        const blocks = await this.blockRepository.find({
            where: [{ blocker: { id: userId } }, { blocked: { id: userId } }],
            relations: ['blocker', 'blocked'],
        });

        const ids = new Set<number>();
        for (const b of blocks) {
            // 두 사람 중 '내가 아닌 쪽'을 담는다.
            ids.add(b.blocker.id === userId ? b.blocked.id : b.blocker.id);
        }

        return [...ids];
    }

    /** 상대방 프로필을 열 수 있는지. 차단 관계면 못 연다. */
    async assertNotBlocked(viewerId: number, targetId: number) {
        const hidden = await this.getHiddenUserIds(viewerId);

        if (hidden.includes(targetId)) {
            throw new DomainException('USER_BLOCKED');
        }
    }

    /** 여러 명 중 차단 관계인 사람이 있는지 한 번에 확인 (목록에서 쓴다) */
    async filterHidden(userId: number, candidateIds: number[]) {
        if (candidateIds.length === 0) return [];

        const blocks = await this.blockRepository.find({
            where: [
                { blocker: { id: userId }, blocked: { id: In(candidateIds) } },
                { blocked: { id: userId }, blocker: { id: In(candidateIds) } },
            ],
            relations: ['blocker', 'blocked'],
        });

        return blocks.map((b) => (b.blocker.id === userId ? b.blocked.id : b.blocker.id));
    }
}
