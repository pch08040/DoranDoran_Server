import { HttpException, Logger } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { DomainException } from 'src/common/exception/domain.exception';
import { ErrorCode } from 'src/common/const/error-code.const';
import {
    ConnectedSocket,
    MessageBody,
    OnGatewayConnection,
    OnGatewayDisconnect,
    SubscribeMessage,
    WebSocketGateway,
    WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AuthService } from 'src/auth/auth.service';
import { UsersService } from 'src/users/users.service';
import { ChatService } from './chat.service';
import { SendMessageDto } from './dto/send-message.dto';

/** 소켓 한 개에 붙여두는 정보. 연결이 살아있는 동안 계속 쓴다. */
interface SocketData {
    userId: number;
}

/**
 * 이야기(채팅)의 실시간 부분. (기획서 Phase 6 / DEV_GUIDE 7장에서 WebSocket 확정)
 *
 * **소켓으로 하는 일은 딱 두 가지다 — 메시지 보내기, 읽음 알리기.**
 * 목록·대화기록·즐겨찾기·나가기는 전부 REST(chat.controller.ts)로 한다.
 *
 * 왜 전부 소켓으로 하지 않는가
 *   Cloud Run 은 열린 연결을 '처리 중인 요청'으로 보고 **최대 60분이면 끊는다.**
 *   소켓으로 다 하면 그 순간 화면이 통째로 죽는다.
 *   목록과 기록이 REST 면, 소켓이 끊겨도 앱은 계속 쓸 수 있고
 *   다시 붙었을 때 실시간만 되살아난다.
 *
 * namespace: 'chat'
 *   나중에 알림 등 다른 소켓이 생겨도 서로 이벤트 이름이 겹치지 않도록 칸을 나눠 둔다.
 *   앱은 `ws://서버주소/chat` 으로 붙는다.
 */
@WebSocketGateway({
    namespace: 'chat',
    // 앱은 브라우저가 아니라 origin 검사에 걸리지 않지만,
    // 개발 중 Flutter Web 으로도 확인할 수 있도록 열어 둔다. (HTTP 쪽 enableCors 와 동일한 수준)
    cors: { origin: '*' },
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
    private readonly logger = new Logger(ChatGateway.name);

    @WebSocketServer()
    server: Server;

    constructor(
        private readonly chatService: ChatService,
        private readonly authService: AuthService,
        private readonly usersService: UsersService,
    ) { }

    // ── 연결 · 해제 ───────────────────────────────────────────

    /**
     * 앱이 소켓을 연결할 때 딱 한 번 불린다. 여기서 **누구인지 확인**한다.
     *
     * 토큰을 헤더가 아니라 handshake.auth 로 받는 이유
     *   소켓 연결은 HTTP 요청이 아니라 헤더를 마음대로 붙일 수 없는 환경(웹소켓)이 있다.
     *   socket.io 는 연결할 때 `auth` 라는 봉투를 따로 제공한다. 그쪽이 표준적이다.
     *
     * 확인에 실패하면 **바로 끊는다.** 여기서 안 끊으면 신원 미상의 연결이
     * 계속 살아남아 이벤트를 쏠 수 있다.
     */
    async handleConnection(socket: Socket) {
        try {
            const token = this.extractToken(socket);
            const payload = this.authService.verifyToken(token);

            if (payload.type !== 'access') {
                throw new Error('access 토큰이 아님');
            }

            const user = await this.usersService.getUserByPhoneNumber(payload.phoneNumber);

            // 토큰은 멀쩡한데 그 사이 탈퇴해서 유저가 없어졌을 수 있다.
            // 확인하지 않으면 userId 가 undefined 인 채로 연결이 살아남는다.
            if (!user) throw new Error('토큰의 주인을 찾을 수 없음');

            (socket.data as SocketData).userId = user.id;

            /**
             * 자기 자신만의 방에 넣어 둔다. 이름은 'user-3' 처럼.
             *
             * 왜 필요한가 — 상대가 채팅방 화면을 열지 않고 목록만 보고 있어도
             * 새 메시지가 왔다는 걸 알려줘야 빨간 점이 바로 뜬다.
             * 대화방(room-12)에만 보내면 그 화면을 연 사람에게만 간다.
             */
            await socket.join(this.userRoom(user.id));

            this.logger.log(`소켓 연결 — userId=${user.id} socketId=${socket.id}`);
        } catch (e) {
            this.logger.warn(`소켓 인증 실패로 연결을 끊음: ${(e as Error).message}`);

            // 앱이 '왜 끊겼는지' 알아야 재연결을 무한 반복하지 않는다.
            socket.emit('unauthorized', { message: '로그인이 필요합니다.' });
            socket.disconnect(true);
        }
    }

    handleDisconnect(socket: Socket) {
        const userId = (socket.data as SocketData).userId;

        // socket.io 가 join 했던 방에서 알아서 빼주므로 여기서 할 정리는 없다.
        this.logger.log(`소켓 해제 — userId=${userId ?? '미인증'} socketId=${socket.id}`);
    }

    // ── 방 들어가기 · 나오기 (화면 단위) ──────────────────────

    /**
     * 채팅방 **화면을 열었다**는 뜻. 방을 나가는 것(leaveRoom)과 전혀 다르다.
     *
     * 이걸 해야 그 방에 오는 메시지를 실시간으로 받는다.
     * 앱은 화면에 들어갈 때 enter_room, 화면을 닫을 때 exit_room 을 보낸다.
     */
    @SubscribeMessage('enter_room')
    enterRoom(
        @ConnectedSocket() socket: Socket,
        @MessageBody() body: { roomId: number },
    ) {
        return this.ack(async () => {
            const userId = (socket.data as SocketData).userId;

            // ⚠️ 방 번호만 받고 그대로 join 하면 **남의 대화방을 엿들을 수 있다.**
            //    소켓 이벤트에는 가드가 안 붙으므로 여기서 직접 확인해야 한다.
            //    멤버가 아니면 여기서 예외가 나고 join 은 실행되지 않는다.
            await this.chatService.assertMember(body.roomId, userId);

            await socket.join(this.chatRoom(body.roomId));

            return { roomId: body.roomId, entered: true };
        });
    }

    @SubscribeMessage('exit_room')
    async exitRoom(
        @ConnectedSocket() socket: Socket,
        @MessageBody() body: { roomId: number },
    ) {
        await socket.leave(this.chatRoom(body.roomId));

        return { roomId: body.roomId, entered: false };
    }

    // ── 메시지 ────────────────────────────────────────────────

    /** 메시지 보내기. (시안: 이야기_창.png 의 종이비행기 버튼) */
    @SubscribeMessage('send_message')
    sendMessage(
        @ConnectedSocket() socket: Socket,
        @MessageBody() raw: unknown,
    ) {
        return this.ack(async () => {
            const userId = (socket.data as SocketData).userId;
            const dto = this.parse(SendMessageDto, raw);

            const { message, partnerId } = await this.chatService.appendMessage(userId, dto);

        /**
         * 보내는 곳이 두 군데인 이유
         *   room-12   그 대화방 화면을 열고 있는 사람들 → 말풍선이 바로 뜬다
         *   user-7    상대가 목록 화면에 있을 때 → 미리보기와 빨간 점이 갱신된다
         *
         * 상대가 채팅방 화면에 있으면 두 곳 모두에 속하므로 같은 메시지를 두 번 받는다.
         * 앱은 **메시지 id 로 중복을 걸러낸다.** (chat_provider.dart)
         * 여기서 '어느 쪽에 있는지' 를 서버가 추적하려 들면 상태가 하나 더 늘고,
         * 그 상태가 어긋나는 순간 메시지가 아예 안 가는 쪽이 생긴다.
         */
            this.server.to(this.chatRoom(dto.roomId)).emit('message', {
                roomId: dto.roomId,
                ...message,
            });

            this.server.to(this.userRoom(partnerId)).emit('room_updated', {
                roomId: dto.roomId,
            });

            // 보낸 쪽에는 '저장된 진짜 메시지'를 응답으로 돌려준다.
            // 앱은 먼저 회색으로 그려둔 임시 말풍선을 이걸로 바꿔치기한다.
            return { roomId: dto.roomId, ...message };
        });
    }

    /** "여기까지 읽었다". */
    @SubscribeMessage('read')
    read(
        @ConnectedSocket() socket: Socket,
        @MessageBody() body: { roomId: number; lastMessageId: number },
    ) {
        return this.ack(async () => {
            const userId = (socket.data as SocketData).userId;

            const result = await this.chatService.markAsRead(
                userId,
                body.roomId,
                body.lastMessageId,
            );

            return { roomId: body.roomId, ...result };
        });
    }

    // ── 다른 곳(REST)에서 부르는 알림 ─────────────────────────

    /**
     * 누군가 방을 나갔다고 상대에게 알린다. **chat.controller.ts 의 DELETE 가 부른다.**
     *
     * REST 로 처리한 일을 소켓으로도 알리는 이유
     *   상대는 지금 그 채팅방을 보고 있을 수 있다. 알리지 않으면
     *   상대 화면에는 아무 일도 없다가, 메시지를 보내려는 순간에야
     *   '상대방이 나갔어요' 오류를 만난다.
     */
    notifyRoomLeft(roomId: number, partnerId: number | null) {
        this.server.to(this.chatRoom(roomId)).emit('partner_left', { roomId });

        if (partnerId !== null) {
            this.server.to(this.userRoom(partnerId)).emit('room_updated', { roomId });
        }
    }

    // ── 오류를 앱에 되돌려주는 방법 ───────────────────────────

    /**
     * 소켓 핸들러를 감싸서 **실패해도 반드시 응답(ack)이 가게** 한다.
     *
     * 왜 필요한가 — 처음에는 @UsePipes(ValidationPipe) 를 붙이고 예외를 그냥 던졌다.
     * 그랬더니 500자를 넘긴 메시지를 보냈을 때 **앱이 영영 응답을 못 받았다.**
     * (실제 테스트에서 2분 동안 매달려 있었다)
     *
     * HTTP 는 실패해도 4xx 응답이 돌아오지만, 소켓에서 던진 예외는
     * ack 를 채우지 않고 별도의 'exception' 이벤트로 새어 나간다.
     * 앱은 "보내는 중" 표시를 지울 계기를 영영 못 얻는다.
     *
     * 그래서 성공이든 실패든 **같은 자리(ack)로 돌려준다.**
     * 실패는 HTTP 와 똑같은 { code, message } 모양이라 앱이 한 벌의 코드로 처리한다.
     */
    private async ack<T>(work: () => Promise<T>) {
        try {
            return await work();
        } catch (e) {
            if (e instanceof HttpException) {
                const body = e.getResponse() as { code?: ErrorCode; message?: string };

                return {
                    error: {
                        code: body.code ?? 'REQUEST_FAILED',
                        message: body.message ?? '요청을 처리할 수 없어요.',
                    },
                };
            }

            // 우리가 예상하지 못한 오류. 자세한 내용은 로그에만 남긴다.
            this.logger.error(`소켓 처리 실패: ${(e as Error).message}`, (e as Error).stack);

            return {
                error: { code: 'INTERNAL_ERROR', message: '일시적인 오류가 발생했어요.' },
            };
        }
    }

    /**
     * 소켓으로 들어온 값을 DTO 로 바꾸고 검증한다.
     *
     * 전역 ValidationPipe 를 못 쓰는 이유는 위 ack() 설명과 같다.
     * 파이프는 **핸들러가 시작되기 전에** 예외를 던져서 ack 를 채울 수 없다.
     * 그래서 핸들러 안에서 직접 검증한다. 이러면 실패도 ack 로 돌아간다.
     */
    private parse<T extends object>(cls: new () => T, raw: unknown): T {
        const dto = plainToInstance(cls, raw ?? {}, {
            enableImplicitConversion: true,
        });

        const errors = validateSync(dto, { whitelist: true });

        if (errors.length > 0) {
            // 사용자에게 보여줄 첫 번째 문구만 고른다. (DTO 에 한국어로 적어뒀다)
            const first = Object.values(errors[0].constraints ?? {})[0];

            throw new DomainException('VALIDATION_FAILED', first);
        }

        return dto;
    }

    // ── 도우미 ────────────────────────────────────────────────

    /** socket.io 안에서 쓰는 방 이름. 문자열을 직접 적으면 오타가 조용히 넘어간다. */
    private chatRoom(roomId: number) {
        return `room-${roomId}`;
    }

    private userRoom(userId: number) {
        return `user-${userId}`;
    }

    /**
     * 연결할 때 앱이 보낸 토큰을 꺼낸다.
     *
     * auth.token 을 우선 보고, 없으면 헤더도 본다.
     * (개발 중 Postman 같은 도구로 붙어볼 때 헤더가 더 편하다)
     */
    private extractToken(socket: Socket): string {
        const fromAuth = socket.handshake.auth?.token as string | undefined;
        if (fromAuth) return fromAuth;

        const rawHeader = socket.handshake.headers.authorization;
        if (rawHeader) return this.authService.extractTokenFromHeader(rawHeader, true);

        throw new Error('토큰이 없음');
    }
}
