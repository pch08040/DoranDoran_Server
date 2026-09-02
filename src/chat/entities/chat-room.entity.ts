import { Column, Entity, Index, OneToMany } from 'typeorm';
import { BaseModel } from 'src/common/entity/base.entity';
import { ChatRoomMemberModel } from './chat-room-member.entity';
import { ChatMessageModel } from './chat-message.entity';

/**
 * 대화방 하나. (기획서 Phase 6 / 시안: 이야기_홈.png)
 *
 * 방을 3장(rooms / members / messages)으로 나눈 이유는 DEV_GUIDE 1-5절에 있다.
 * 요약하면 — '즐겨찾기'와 '나가기'는 **방의 성질이 아니라 그 사람의 성질**이다.
 * A만 즐겨찾기할 수 있고 A만 나갈 수 있다. 방에 붙이면 그걸 표현할 수 없다.
 */
@Entity()
export class ChatRoomModel extends BaseModel {
    /**
     * 두 사람 조합을 나타내는 열쇠. 예) '3:7'
     *
     * **유니크**여야 한다. 이유는 chat.const.ts 의 makePairKey 설명 참고.
     * (같은 상대와 방이 두 개 생기면 서로 다른 방에 대고 말하게 된다)
     */
    @Index({ unique: true })
    @Column()
    pairKey: string;

    /** 방에 속한 사람들. 1:1 이라 항상 2명이다. */
    @OneToMany(() => ChatRoomMemberModel, (member) => member.room)
    members: ChatRoomMemberModel[];

    @OneToMany(() => ChatMessageModel, (message) => message.room)
    messages: ChatMessageModel[];

    /**
     * 마지막 메시지의 시각과 내용을 **방에도 베껴 둔다.**
     *
     * 원래 이 값은 chat_messages 를 뒤지면 알 수 있는 정보다.
     * 그런데 이야기 목록 화면은 방마다 "마지막 대화 한 줄 + 그 시각"을 보여주고
     * **최신 대화순으로 정렬**한다. (시안: 이야기_홈.png)
     *
     * 베껴두지 않으면 방 20개를 그릴 때 메시지 테이블을 20번 따로 뒤져야 하고,
     * 정렬은 그마저도 안 된다(정렬하려면 전부 뒤진 뒤에야 순서를 알 수 있다).
     *
     * ⚠️ 베낀 값이므로 **메시지를 저장할 때 반드시 같이 갱신**해야 한다.
     *    한 곳이라도 빠뜨리면 목록의 미리보기만 옛날 것으로 남는다.
     *    → chat.service.ts 의 appendMessage() 한 곳에서만 쓰기로 정했다.
     */
    @Column({ type: 'timestamptz', nullable: true })
    lastMessageAt: Date | null;

    /**
     * 목록에 보여줄 마지막 대화 한 줄.
     * 사진 메시지는 글자가 없으므로 '사진을 보냈어요' 같은 문구가 대신 들어간다.
     */
    @Column({ type: 'varchar', nullable: true })
    lastMessageText: string | null;
}
