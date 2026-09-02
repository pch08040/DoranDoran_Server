import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { And, DataSource, In, IsNull, LessThan, MoreThan, Repository } from 'typeorm';
import { DomainException } from 'src/common/exception/domain.exception';
import { StorageService } from 'src/common/storage/storage.service';
import { ImageModelType } from 'src/common/entity/image.entity';
import { DEFAULT_PROFILE_OBJECT } from 'src/common/const/path.const';
import { ModerationService } from 'src/moderation/moderation.service';
import { UsersModel } from 'src/users/entities/users.entity';
import { ChatRoomModel } from './entities/chat-room.entity';
import { ChatRoomMemberModel } from './entities/chat-room-member.entity';
import { ChatMessageModel, ChatMessageType } from './entities/chat-message.entity';
import { PaginateMessageDto } from './dto/paginate-message.dto';
import { SendMessageDto } from './dto/send-message.dto';
import { makePairKey, SYSTEM_MESSAGE_PARTNER_LEFT } from './const/chat.const';

/** 앱에 내려줄 상대방 정보. 전화번호·권한 같은 건 절대 싣지 않는다. */
export interface ChatPartner {
    id: number;
    firstName: string;
    lastName: string;
    images: { path: string }[];
}

@Injectable()
export class ChatService {
    private readonly logger = new Logger(ChatService.name);

    constructor(
        @InjectRepository(ChatRoomModel)
        private readonly roomRepository: Repository<ChatRoomModel>,
        @InjectRepository(ChatRoomMemberModel)
        private readonly memberRepository: Repository<ChatRoomMemberModel>,
        @InjectRepository(ChatMessageModel)
        private readonly messageRepository: Repository<ChatMessageModel>,
        @InjectRepository(UsersModel)
        private readonly usersRepository: Repository<UsersModel>,
        private readonly moderationService: ModerationService,
        private readonly storageService: StorageService,
        private readonly dataSource: DataSource,
    ) { }

    // ── 방 열기 ───────────────────────────────────────────────

    /**
     * 이 사람과의 방을 연다. 없으면 만들고, 있으면 그대로 쓴다.
     * (시안: 상대방 프로필 하단 "이야기를 시작하세요!" / 와글와글 카드의 '메세지 보내기')
     */
    async openRoom(myId: number, targetUserId: number) {
        if (myId === targetUserId) {
            throw new DomainException('VALIDATION_FAILED', '자기 자신과는 대화할 수 없어요.');
        }

        // 차단 관계면 여기서 막힌다. 내가 차단했든 상대가 나를 차단했든 같은 결과다.
        await this.moderationService.assertNotBlocked(myId, targetUserId);

        const partner = await this.usersRepository.findOne({
            where: { id: targetUserId },
            relations: ['images'],
        });

        if (!partner) throw new DomainException('USER_NOT_FOUND');

        const pairKey = makePairKey(myId, targetUserId);
        let room = await this.roomRepository.findOne({ where: { pairKey } });

        if (!room) {
            room = await this.createRoom(pairKey, myId, targetUserId);
        }

        // 내가 예전에 나갔던 방이면 다시 들어간다.
        await this.rejoinIfLeft(room.id, myId);

        return { roomId: room.id, partner: this.toPartner(partner) };
    }

    /**
     * 방과 멤버 2명을 만든다.
     *
     * 트랜잭션으로 묶는 이유
     *   방만 만들어지고 멤버를 넣기 전에 서버가 죽으면 **아무도 못 들어가는 방**이 남는다.
     *   pairKey 가 유니크라 그 뒤로는 그 두 사람이 영원히 방을 못 만든다.
     *   묶어두면 셋 다 되거나 셋 다 안 된다.
     */
    private async createRoom(pairKey: string, myId: number, targetUserId: number) {
        try {
            return await this.dataSource.transaction(async (manager) => {
                const room = await manager.save(
                    manager.create(ChatRoomModel, { pairKey }),
                );

                await manager.save([
                    manager.create(ChatRoomMemberModel, { room, user: { id: myId } }),
                    manager.create(ChatRoomMemberModel, { room, user: { id: targetUserId } }),
                ]);

                return room;
            });
        } catch (e) {
            /**
             * 23505 = PostgreSQL 의 '유니크 제약 위반'.
             *
             * 언제 나는가 — 나와 상대가 **같은 순간에** 서로에게 말을 걸었을 때다.
             * 둘 다 "방이 없네" 를 보고 둘 다 만들려 하는데, DB가 두 번째를 거절한다.
             *
             * 이건 오류가 아니라 **의도한 방어가 제대로 작동한 것**이다.
             * 진 쪽은 이긴 쪽이 방금 만든 방을 그대로 쓰면 된다.
             */
            if ((e as { code?: string }).code !== '23505') throw e;

            this.logger.log(`방 생성 경합 — 이미 만들어진 방을 사용한다 (pairKey=${pairKey})`);

            const room = await this.roomRepository.findOne({ where: { pairKey } });
            if (!room) throw e; // 23505 인데 방이 없다면 진짜 이상한 상황이다

            return room;
        }
    }

    /** 나갔던 방에 다시 들어간다. 나간 적이 없으면 아무것도 하지 않는다. */
    private async rejoinIfLeft(roomId: number, myId: number) {
        const member = await this.findMembership(roomId, myId);

        if (member && member.leftAt) {
            member.leftAt = null;
            await this.memberRepository.save(member);
        }
    }

    // ── 목록 ──────────────────────────────────────────────────

    /** 이야기 목록. (시안: 이야기_홈.png) */
    async getMyRooms(myId: number) {
        const memberships = await this.memberRepository.find({
            /**
             * 내가 나가지 않은 방만. (나간 방은 목록에서 사라진다)
             *
             * ⚠️ `leftAt: null` 이라고 쓰면 안 된다.
             *    TypeORM 은 값이 null 인 조건을 **'조건 없음'으로 보고 통째로 무시한다.**
             *    그러면 나간 방까지 전부 목록에 나온다. IsNull() 을 써야 IS NULL 이 된다.
             */
            where: { user: { id: myId }, leftAt: IsNull() },
            relations: ['room'],
        });

        if (memberships.length === 0) return [];

        const roomIds = memberships.map((m) => m.room.id);

        /**
         * 상대방 정보를 **한 번에** 모아 온다.
         *
         * 방마다 따로 조회하면 방이 20개일 때 요청이 20번 나간다(N+1 문제).
         * 목록 화면은 처음 열 때 전부 그려야 하므로 그 20번이 그대로 체감 지연이 된다.
         */
        const partners = await this.memberRepository.find({
            where: { room: { id: In(roomIds) } },
            relations: ['room', 'user', 'user.images'],
        });

        const partnerByRoom = new Map<number, ChatRoomMemberModel>();
        for (const p of partners) {
            if (p.user.id !== myId) partnerByRoom.set(p.room.id, p);
        }

        // 차단 관계인 사람과의 방은 목록에서 감춘다. (기획서 BE-Block-001)
        const hiddenIds = await this.moderationService.getHiddenUserIds(myId);

        const rows = await Promise.all(
            memberships.map(async (me) => {
                const partnerMember = partnerByRoom.get(me.room.id);
                if (!partnerMember) return null;
                if (hiddenIds.includes(partnerMember.user.id)) return null;

                return this.toRoomRow(me, partnerMember, myId);
            }),
        );

        const visible = rows.filter((r): r is NonNullable<typeof r> => r !== null);

        /**
         * 최신 대화순. 아직 한 마디도 안 한 방은 만든 시각으로 줄을 세운다.
         *
         * DB의 ORDER BY 로 하지 않는 이유
         *   정렬 기준(lastMessageAt)이 chat_room_model 에 있고
         *   걸러내는 조건(내 멤버십·차단)은 다른 테이블에 있어서
         *   한 번의 쿼리로 하려면 조인이 3중이 된다.
         *   방 개수는 사람당 수십 개 수준이라 여기서 정렬해도 부담이 없다.
         *   (수백 개가 되면 그때 쿼리빌더로 옮긴다)
         */
        return visible.sort((a, b) => {
            const at = (a.lastMessageAt ?? new Date(0)).getTime();
            const bt = (b.lastMessageAt ?? new Date(0)).getTime();
            return bt - at;
        });
    }

    /** 안 읽은 메시지 개수. (시안 이야기_홈.png 의 빨간 점) */
    private async countUnread(me: ChatRoomMemberModel, myId: number) {
        return this.messageRepository
            .createQueryBuilder('message')
            .where('message."roomId" = :roomId', { roomId: me.room.id })
            // 내가 마지막으로 읽은 지점보다 뒤에 온 것
            .andWhere('message.id > :lastRead', { lastRead: me.lastReadMessageId })
            // 나간 뒤 다시 들어왔다면, 그 이전 것은 애초에 나에게 없는 메시지다
            .andWhere('message.id > :cleared', { cleared: me.clearedMessageId })
            // 내가 보낸 건 당연히 읽은 것이다
            .andWhere('(message."senderId" IS NULL OR message."senderId" != :myId)', {
                myId,
            })
            .getCount();
    }

    /**
     * 대화방 한 개. **채팅방 화면이 열릴 때 부른다.**
     *
     * 목록에서 들어올 때는 이미 아는 정보지만, 상대방 프로필이나 와글와글 카드에서
     * 바로 들어오는 길도 있다. 그때는 앱이 상대 이름도 사진도 모른다.
     * 화면마다 다른 방법으로 채우게 두면 어느 한쪽에서만 이름이 비는 일이 생긴다.
     */
    async getRoom(myId: number, roomId: number) {
        const me = await this.assertMembership(roomId, myId);
        const partner = await this.findPartnerMembership(roomId, myId);

        if (!partner) throw new DomainException('CHAT_ROOM_NOT_FOUND');

        // 차단 관계면 방 자체를 열어주지 않는다.
        await this.moderationService.assertNotBlocked(myId, partner.user.id);

        return this.toRoomRow(me, partner, myId);
    }

    /** 목록 한 줄 / 단건 조회가 **같은 모양**이 되도록 한 곳에서 만든다. */
    private async toRoomRow(
        me: ChatRoomMemberModel,
        partnerMember: ChatRoomMemberModel,
        myId: number,
    ) {
        return {
            roomId: me.room.id,
            partner: this.toPartner(partnerMember.user),
            lastMessage: me.room.lastMessageText,
            lastMessageAt: me.room.lastMessageAt,
            isFavorite: me.isFavorite,
            /** 상대가 먼저 나갔는지. 앱은 이걸 보고 입력창을 감춘다 */
            partnerLeft: partnerMember.leftAt !== null,
            unreadCount: await this.countUnread(me, myId),
        };
    }

    // ── 대화 기록 ─────────────────────────────────────────────

    /** 지난 대화를 불러온다. (시안: 이야기_창.png) */
    async getMessages(myId: number, roomId: number, dto: PaginateMessageDto) {
        const me = await this.assertMembership(roomId, myId);

        const where: Record<string, unknown> = {
            room: { id: roomId },
            // 내가 나갔다 다시 들어왔다면 그 이전 대화는 안 보여준다
            id: MoreThan(me.clearedMessageId),
        };

        // beforeId 가 있으면 "그보다 이전 것"으로 좁힌다.
        // ⚠️ 위에서 이미 id 조건을 썼으므로 덮어쓰지 말고 두 조건을 합쳐야 한다.
        if (dto.beforeId) {
            where.id = And(MoreThan(me.clearedMessageId), LessThan(dto.beforeId));
        }

        /**
         * **최신 것부터** take+1 개를 읽는다.
         *
         * take 가 아니라 take+1 인 이유
         *   "더 불러올 게 남았는지"를 알려면 한 개를 더 집어보면 된다.
         *   따로 COUNT 쿼리를 날리면 요청이 두 번이 되고, 그 사이에 메시지가 오면
         *   개수와 실제 목록이 어긋난다.
         */
        const rows = await this.messageRepository.find({
            where,
            relations: ['sender'],
            order: { id: 'DESC' },
            take: dto.take + 1,
        });

        const hasMore = rows.length > dto.take;
        const page = hasMore ? rows.slice(0, dto.take) : rows;

        return {
            // 화면은 위에서 아래로 오래된 순으로 그린다. 뒤집어서 준다.
            data: page.reverse().map((m) => this.toMessage(m)),
            hasMore,
        };
    }

    // ── 메시지 보내기 ─────────────────────────────────────────

    /**
     * 메시지를 저장한다. **소켓(chat.gateway.ts)이 부른다.**
     *
     * 저장과 중계를 나눈 이유
     *   여기서 저장까지만 하고, 누구에게 보낼지는 게이트웨이가 정한다.
     *   그래야 나중에 푸시 알림(Phase 8)을 붙일 때도 이 함수를 그대로 재사용할 수 있다.
     */
    async appendMessage(myId: number, dto: SendMessageDto) {
        const content = dto.content?.trim();

        if (!content && !dto.imageFileName) {
            throw new DomainException('VALIDATION_FAILED', '보낼 내용이 없어요.');
        }

        const me = await this.assertMembership(dto.roomId, myId);
        const partner = await this.findPartnerMembership(dto.roomId, myId);

        if (!partner) throw new DomainException('CHAT_ROOM_NOT_FOUND');
        if (partner.leftAt) throw new DomainException('CHAT_PARTNER_LEFT');

        // 차단된 사이면 보낼 수 없다.
        // 매번 확인하는 이유 — 대화 도중에 상대가 나를 차단할 수 있다.
        // (시안: 이야기_차단하기.png 는 채팅방 안에서 바로 차단하는 화면이다)
        await this.moderationService.assertNotBlocked(myId, partner.user.id);

        // 사진은 임시 폴더에 올라와 있다. 최종 위치(chats/)로 옮긴다.
        const imagePath = dto.imageFileName
            ? await this.storageService.moveFromTemp(dto.imageFileName, 'chats')
            : null;

        const saved = await this.messageRepository.save(
            this.messageRepository.create({
                room: { id: dto.roomId },
                sender: { id: myId },
                type: imagePath ? ChatMessageType.IMAGE : ChatMessageType.TEXT,
                content: content ?? null,
                imagePath,
            }),
        );

        await this.touchRoom(dto.roomId, saved);

        // 내가 보낸 메시지는 보낸 즉시 읽은 것으로 친다.
        me.lastReadMessageId = saved.id;
        await this.memberRepository.save(me);

        return {
            partnerId: partner.user.id,
            message: this.toMessage({ ...saved, sender: { id: myId } as UsersModel }),
        };
    }

    /**
     * 방의 '마지막 대화' 미리보기를 갱신한다.
     *
     * ⚠️ 메시지를 저장하는 곳은 **반드시 이 함수를 같이 불러야 한다.**
     *    안 부르면 목록의 미리보기와 정렬만 옛날 것으로 남는다.
     *    그래서 메시지 저장을 이 파일 안 두 곳(appendMessage / appendSystemMessage)으로
     *    제한하고, 둘 다 여기를 거치게 했다.
     */
    private async touchRoom(roomId: number, message: ChatMessageModel) {
        await this.roomRepository.update(roomId, {
            lastMessageAt: message.createdAt,
            lastMessageText:
                message.type === ChatMessageType.IMAGE
                    ? '사진을 보냈어요'
                    : message.content,
        });
    }

    // ── 읽음 ──────────────────────────────────────────────────

    /** "여기까지 읽었다"를 기록한다. */
    async markAsRead(myId: number, roomId: number, lastMessageId: number) {
        const me = await this.assertMembership(roomId, myId);

        /**
         * 뒤로 가지 않게 막는다.
         *
         * 소켓 메시지는 순서가 보장되지 않는다. 늦게 도착한 옛 알림이
         * 이미 올려둔 읽음 위치를 **되돌려** 안 읽음 개수가 다시 늘어날 수 있다.
         */
        if (lastMessageId <= me.lastReadMessageId) return { lastReadMessageId: me.lastReadMessageId };

        me.lastReadMessageId = lastMessageId;
        await this.memberRepository.save(me);

        return { lastReadMessageId: me.lastReadMessageId };
    }

    // ── 즐겨찾기 · 나가기 ─────────────────────────────────────

    /** 즐겨찾기 켜고 끄기. (시안: 목록을 옆으로 밀면 나오는 하트) */
    async setFavorite(myId: number, roomId: number, isFavorite: boolean) {
        const me = await this.assertMembership(roomId, myId);

        me.isFavorite = isFavorite;
        await this.memberRepository.save(me);

        return { roomId, isFavorite };
    }

    /**
     * 방을 나간다. (시안: 이야기_나가기.png "정말로 이야기를 나가시겠어요?")
     *
     * 하는 일 3가지
     *   1) 내 목록에서 감춘다 (leftAt)
     *   2) 지금까지의 대화를 나에게만 안 보이게 선을 긋는다 (clearedMessageId)
     *   3) 상대의 대화창에 '상대방이 이야기를 나갔습니다.' 를 남긴다
     */
    async leaveRoom(myId: number, roomId: number) {
        const me = await this.assertMembership(roomId, myId);
        const partner = await this.findPartnerMembership(roomId, myId);

        /**
         * ⚠️ **순서가 중요하다. 안내 메시지를 먼저 남기고 그 다음에 선을 긋는다.**
         *
         * 반대로 하면 이런 일이 생긴다 (실제로 겪었다) —
         *   A가 나감 → 마지막 메시지 id(2)까지 지운 것으로 표시
         *            → 그 뒤에 안내 메시지(id 3)가 생김
         *            → A가 다시 말을 걸면 id 3 은 '지운 선' 바깥이라 보인다
         *            → **나간 건 A인데 A 화면에 "상대방이 이야기를 나갔습니다"가 뜬다.**
         *
         * 안내를 먼저 만들어 두면 그 id 까지 한꺼번에 선 안쪽으로 들어간다.
         */
        // 상대도 이미 나갔다면 안내를 남길 대상이 없다. 조용히 넘어간다.
        const notice = partner && !partner.leftAt
            ? await this.appendSystemMessage(roomId, SYSTEM_MESSAGE_PARTNER_LEFT)
            : null;

        const lastId = notice?.id ?? (await this.messageRepository.findOne({
            where: { room: { id: roomId } },
            order: { id: 'DESC' },
        }))?.id;

        me.leftAt = new Date();
        me.clearedMessageId = lastId ?? me.clearedMessageId;
        me.lastReadMessageId = lastId ?? me.lastReadMessageId;
        await this.memberRepository.save(me);

        return {
            roomId,
            partnerId: partner?.user.id ?? null,
            message: '대화방을 나갔습니다.',
        };
    }

    /** 서버가 끼워 넣는 안내 메시지. 보낸 사람이 없다(sender = null). */
    private async appendSystemMessage(roomId: number, text: string) {
        const saved = await this.messageRepository.save(
            this.messageRepository.create({
                room: { id: roomId },
                sender: null,
                type: ChatMessageType.SYSTEM,
                content: text,
                imagePath: null,
            }),
        );

        await this.touchRoom(roomId, saved);

        return saved;
    }

    // ── 공통 도우미 ───────────────────────────────────────────

    /**
     * 이 방의 사람인지 확인만 한다. **소켓이 방에 넣기 전에 부른다.**
     *
     * 소켓 이벤트에는 가드(@UseGuards)가 붙지 않는다.
     * 확인 없이 join 하면 방 번호를 1부터 넣어보는 것만으로
     * **남의 대화를 실시간으로 엿들을 수 있다.**
     */
    async assertMember(roomId: number, userId: number) {
        await this.assertMembership(roomId, userId);
    }

    private findMembership(roomId: number, userId: number) {
        return this.memberRepository.findOne({
            where: { room: { id: roomId }, user: { id: userId } },
            relations: ['room', 'user'],
        });
    }

    /**
     * 내가 이 방의 사람인지 확인하고, 아니면 막는다.
     *
     * **없는 방과 남의 방을 같은 에러로 처리한다.**
     * 구분해서 알려주면 방 번호를 1부터 넣어보는 것만으로
     * "몇 번 방이 존재하는지"를 알아낼 수 있다.
     */
    private async assertMembership(roomId: number, userId: number) {
        const member = await this.findMembership(roomId, userId);

        if (!member) throw new DomainException('CHAT_ROOM_NOT_FOUND');
        if (member.leftAt) throw new DomainException('CHAT_ROOM_LEFT');

        return member;
    }

    /** 방에서 '내가 아닌 쪽' */
    private findPartnerMembership(roomId: number, myId: number) {
        return this.memberRepository
            .createQueryBuilder('member')
            .leftJoinAndSelect('member.user', 'user')
            .leftJoinAndSelect('user.images', 'images')
            .where('member."roomId" = :roomId', { roomId })
            .andWhere('member."userId" != :myId', { myId })
            .getOne();
    }

    /**
     * 앱에 내려줄 상대방 정보만 골라낸다. 전화번호·권한은 절대 싣지 않는다.
     *
     * 사진을 그냥 `user.images` 로 넘기면 안 되는 이유 2가지 (실제로 겪었다)
     *
     *   ① **임시 사진이 섞여 나온다.**
     *      프로필을 바꿀 때 올렸다가 확정되지 않은 TEMP_IMAGE 가 users 에 매달린 채 남는다.
     *      그 파일은 창고(GCS)가 하루 뒤 지우므로, 대화 목록의 얼굴이 어느 날 깨진다.
     *      실제 응답에 `.../temp/cda1c3bb-....jpg` 가 그대로 실려 나왔다.
     *
     *   ② **사진이 없는 사람은 빈 배열이 나간다.**
     *      users.entity.ts 는 사진이 없으면 기본 프로필을 넣어주는 @Transform 을 갖고 있는데,
     *      그건 UsersModel 을 통째로 내려보낼 때만 동작한다.
     *      여기처럼 필요한 값만 골라 새 객체를 만들면 그 장치를 거치지 않는다.
     *      그대로 두면 대화 목록에서 얼굴 자리가 빈칸으로 남는다.
     */
    private toPartner(user: UsersModel): ChatPartner {
        const profileImages = (user.images ?? [])
            .filter((image) => image.type === ImageModelType.USER_IMAGE)
            .map((image) => ({ path: this.storageService.publicUrl(image.path) }));

        return {
            id: user.id,
            firstName: user.firstName,
            lastName: user.lastName,
            images: profileImages.length > 0
                ? profileImages
                : [{ path: this.storageService.publicUrl(DEFAULT_PROFILE_OBJECT) }],
        };
    }

    /**
     * 앱에 내려줄 메시지 한 줄.
     *
     * ⚠️ **'내 것인지(isMine)'는 여기 담지 않는다.**
     *   처음에는 서버가 정해서 내려줬는데, 소켓 중계에서 그대로 터졌다.
     *   같은 메시지 하나를 방에 있는 두 사람에게 **똑같이** 뿌리기 때문에,
     *   보낸 사람 기준으로 isMine: true 를 박아 보내면
     *   **받는 쪽 화면에서도 상대 말풍선이 내 쪽(오른쪽)에 그려진다.**
     *   (실제로 테스트에서 B가 isMine:true 를 받았다)
     *
     *   왼쪽/오른쪽은 **보는 사람마다 다른 값**이므로 받는 쪽에서 정해야 한다.
     *   앱은 senderId 와 내 id 를 비교한다. (chat_message_model.dart)
     */
    private toMessage(m: ChatMessageModel) {
        return {
            id: m.id,
            type: m.type,
            content: m.content,
            imagePath: m.imagePath,
            senderId: m.sender?.id ?? null,
            createdAt: m.createdAt,
        };
    }
}
