import { Body, Controller, Delete, Get, Param, ParseIntPipe, Post } from '@nestjs/common';
import { ModerationService } from './moderation.service';
import { User } from 'src/users/decorator/user.decorator';
import { UsersModel } from 'src/users/entities/users.entity';
import { CreateReportDto } from './dto/create-report.dto';
import { REPORT_REASON_LABELS, ReportReason } from './const/report-reason.const';

/**
 * 신고 사유 목록. (시안: 신고하기-1.png 의 10가지)
 *
 * ⚠️ 주소를 `/users/report-reasons` 가 아니라 `/reports/reasons` 로 둔 이유
 *   UsersController 에 `GET /users/:id` 가 있는데 ':id' 는 **아무 글자나 받는다.**
 *   그래서 'report-reasons' 도 id 로 해석돼 숫자 변환에 실패하고 400 이 났다.
 *
 *   해결하려 시도했다가 실패한 것 두 가지
 *     1. `:id(\d+)` 로 숫자만 받게 하기
 *        → NestJS 11 이 쓰는 path-to-regexp v8 에서 이 문법이 없어졌다. 서버가 아예 안 뜬다.
 *     2. app.module 에서 모듈 등록 순서 바꾸기
 *        → NestJS 는 모듈을 **의존 관계 순서**로 훑는다.
 *          UsersModule 이 ModerationModule 을 가져다 쓰므로 순서가 안 바뀐다.
 *
 *   **순서에 기대지 말고 주소를 안 겹치게 두는 것**이 확실하다.
 */
@Controller('reports')
export class ReportReasonsController {
    @Get('reasons')
    getReportReasons() {
        return Object.values(ReportReason).map((code) => ({
            code,
            label: REPORT_REASON_LABELS[code],
        }));
    }
}

/**
 * 신고·차단. 주소는 `/users/...` 아래에 둔다.
 * 신고와 차단은 '유저에 딸린 행위'라 유저 주소 아래가 자연스럽다.
 */
@Controller('users')
export class ModerationController {
    constructor(private readonly moderationService: ModerationService) { }

    /**
     * 내가 차단한 회원 목록. (시안: 차단한 회원.png)
     *
     * ⚠️ 아래 `/users/:id/blocks` 보다 위에 둔다.
     *    같은 파일 안에서는 먼저 적힌 쪽이 이기므로, 'me' 가 :id 로 해석되지 않는다.
     */
    @Get('me/blocks')
    getMyBlocks(@User() user: UsersModel) {
        return this.moderationService.getBlockedUsers(user.id);
    }

    /** 신고하기 (기획서 FE-Report-001) */
    @Post(':id/reports')
    report(
        @User() user: UsersModel,
        @Param('id', ParseIntPipe) targetId: number,
        @Body() dto: CreateReportDto,
    ) {
        return this.moderationService.report(user.id, targetId, dto.reason);
    }

    /** 차단하기 (기획서 FE-Block-001) */
    @Post(':id/blocks')
    block(
        @User() user: UsersModel,
        @Param('id', ParseIntPipe) targetId: number,
    ) {
        return this.moderationService.block(user.id, targetId);
    }

    /** 차단 해제 */
    @Delete(':id/blocks')
    unblock(
        @User() user: UsersModel,
        @Param('id', ParseIntPipe) targetId: number,
    ) {
        return this.moderationService.unblock(user.id, targetId);
    }
}
