import { IsInt, IsOptional, IsString, MaxLength } from 'class-validator';
import { CHAT_MESSAGE_MAX_LENGTH } from '../const/chat.const';

/**
 * 메시지 보내기. **WebSocket(소켓)으로 들어온다.**
 *
 * ⚠️ 소켓으로 들어오는 값도 반드시 검증해야 한다.
 *   HTTP 요청은 main.ts 의 전역 ValidationPipe 가 자동으로 걸러주지만,
 *   소켓 이벤트는 그 파이프를 **거치지 않는다.**
 *   그래서 chat.gateway.ts 에 @UsePipes(ValidationPipe) 를 따로 붙였다.
 *   이걸 빠뜨리면 길이 제한도 타입 검사도 전혀 없는 상태가 된다.
 */
export class SendMessageDto {
    @IsInt({ message: '대화방 정보가 올바르지 않아요.' })
    roomId: number;

    /** 글 내용. 사진만 보낼 때는 없어도 된다. */
    @IsString()
    @IsOptional()
    @MaxLength(CHAT_MESSAGE_MAX_LENGTH, {
        message: `메시지는 ${CHAT_MESSAGE_MAX_LENGTH}자까지 보낼 수 있어요.`,
    })
    content?: string;

    /**
     * 사진. `POST /common/image` 가 돌려준 임시 파일 이름이다.
     *
     * 사진 자체(바이너리)를 소켓으로 보내지 않는 이유
     *   소켓 한 줄에 수 MB 를 실으면 그 연결로 오가는 **다른 모든 메시지가 그동안 막힌다.**
     *   대화 상대의 말이 사진 업로드가 끝날 때까지 안 온다.
     *   무거운 것은 HTTP 로 먼저 올리고, 소켓으로는 '올려둔 파일 이름'만 보낸다.
     */
    @IsString()
    @IsOptional()
    imageFileName?: string;
}
