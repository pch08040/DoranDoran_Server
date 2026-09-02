import { Column, Entity, Index, ManyToOne } from 'typeorm';
import { BaseModel } from 'src/common/entity/base.entity';
import { UsersModel } from 'src/users/entities/users.entity';
import { ChatRoomModel } from './chat-room.entity';

/**
 * "이 사람이 이 방을 어떻게 보고 있는가". (기획서 Phase 6)
 *
 * 즐겨찾기 / 나감 / 어디까지 읽었는지 — 셋 다 **사람마다 다르다.**
 * 그래서 방이 아니라 여기에 둔다. 1:1 방이므로 방 하나당 이 줄이 2개 생긴다.
 */
@Entity()
// 같은 사람이 같은 방에 두 번 들어가지 못하게 막는다.
@Index(['room', 'user'], { unique: true })
/**
 * 이야기 목록은 항상 "내가 속했고, 아직 안 나간 방"을 찾는다.
 * 두 조건을 한 인덱스에 같이 둬야 한 번에 걸러진다.
 */
@Index(['user', 'leftAt'])
export class ChatRoomMemberModel extends BaseModel {
    @ManyToOne(() => ChatRoomModel, (room) => room.members, {
        onDelete: 'CASCADE',
        nullable: false,
    })
    room: ChatRoomModel;

    @ManyToOne(() => UsersModel, { onDelete: 'CASCADE', nullable: false })
    user: UsersModel;

    /** 즐겨찾기(하트). 시안에서 목록을 옆으로 밀면 나오는 회색 하트 버튼. */
    @Column({ default: false })
    isFavorite: boolean;

    /**
     * 내가 이 방을 나간 시각. 안 나갔으면 null.
     *
     * ⚠️ **줄을 지우지 않고 시각만 남긴다.**
     *   지워버리면 이런 일이 생긴다 —
     *     · 상대는 아직 방에 있는데 그 방에 남은 대화의 주인이 사라진다
     *     · 상대에게 '상대방이 나갔습니다' 를 보여줄 근거가 없어진다
     *     · 나갔다가 같은 사람과 다시 대화를 시작하면 방을 새로 만들게 되는데,
     *       pairKey 가 유니크라 저장이 거절된다
     *   시각만 남기면 목록에서만 감추고, 다시 말을 걸면 leftAt 을 null 로 되돌려 재입장한다.
     */
    @Column({ type: 'timestamptz', nullable: true })
    leftAt: Date | null;

    /**
     * "이 id 이하의 메시지는 나에게 보여주지 않는다".
     *
     * 방을 나갔다가 같은 사람과 다시 이야기를 시작했을 때 필요하다.
     * 이 값이 없으면 **나갔던 대화가 통째로 되살아난다.** 나간 의미가 없어진다.
     *
     * 방을 지우지 않고 이 값만 올리는 이유
     *   메시지를 진짜로 지우면 **아직 방에 남아 있는 상대의 대화 기록까지 사라진다.**
     *   내가 나간 것과 상대의 기록은 아무 상관이 없다.
     *   그래서 지우는 대신 '나한테만 안 보이는 선'을 긋는다.
     */
    @Column({ type: 'int', default: 0 })
    clearedMessageId: number;

    /**
     * 내가 마지막으로 읽은 메시지의 id. 아직 아무것도 안 읽었으면 0.
     *
     * 메시지마다 '읽음' 표시를 두지 않는 이유
     *   1:1 대화에서는 "여기까지 읽었다" 한 줄이면 충분하다.
     *   메시지가 10만 개여도 갱신은 이 칸 하나다.
     *   메시지마다 두면 방에 들어갈 때마다 수천 줄을 고쳐 써야 한다.
     *
     * 안 읽은 개수 = 이 방에서 id 가 이 값보다 크고 내가 보낸 게 아닌 메시지 수.
     * (시안 이야기_홈.png 의 빨간 점)
     */
    @Column({ type: 'int', default: 0 })
    lastReadMessageId: number;
}
