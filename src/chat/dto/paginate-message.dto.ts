import { IsInt, IsOptional, Max, Min } from 'class-validator';
import { CHAT_MESSAGE_PAGE_SIZE } from '../const/chat.const';

/** 지난 대화 불러오기. (시안: 이야기_창.png — 위로 밀면 이전 대화가 더 나온다) */
export class PaginateMessageDto {
    /**
     * "이 id 보다 **이전**(작은) 메시지를 달라".
     *
     * 페이지 번호(1,2,3...) 대신 마지막으로 받은 id 를 쓰는 이유
     *   대화 중에는 새 메시지가 계속 쌓인다. 페이지 번호로 세면
     *   내가 2페이지를 넘기는 사이에 3개가 더 와서 **경계에 있던 메시지를 다시 보거나
     *   건너뛴다.** id 기준이면 새 메시지가 몇 개 오든 결과가 흔들리지 않는다.
     *
     * 처음 열 때는 안 보내면 된다. 그러면 가장 최근 것부터 준다.
     */
    @IsInt()
    @IsOptional()
    beforeId?: number;

    /**
     * 한 번에 몇 개.
     *
     * Max 를 거는 이유 — 없으면 앱이 take=100000 을 보내
     * 대화 전체를 한 번에 끌어올 수 있다. 서버 메모리가 그만큼 든다.
     */
    @IsInt()
    @IsOptional()
    @Min(1)
    @Max(100)
    take: number = CHAT_MESSAGE_PAGE_SIZE;
}
