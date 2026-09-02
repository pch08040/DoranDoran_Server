import { Column, Entity, Index, ManyToOne } from 'typeorm';
import { Transform } from 'class-transformer';
import { BaseModel } from 'src/common/entity/base.entity';
import { UsersModel } from 'src/users/entities/users.entity';
import { ENV_GCS_BUCKET_KEY } from 'src/common/const/env-keys.const';
import { ChatRoomModel } from './chat-room.entity';

/** 메시지 종류. (시안: 이야기_창.png / 이야기_사진전송.png / 대화방_상대방 종료.png) */
export enum ChatMessageType {
    /** 보통의 글 말풍선 */
    TEXT = 'TEXT',
    /** 사진 말풍선 */
    IMAGE = 'IMAGE',
    /** '상대방이 이야기를 나갔습니다.' 처럼 서버가 끼워 넣는 안내 */
    SYSTEM = 'SYSTEM',
}

/**
 * 메시지 한 개. (기획서 Phase 6)
 */
@Entity()
/**
 * 대화 기록은 항상 "이 방에서, id 가 어느 값보다 작은 것부터 최신순 30개"로 읽는다.
 * (위로 스크롤하면 그 이전을 더 불러오는 방식)
 * 두 칸이 한 인덱스에 같이 있어야 방을 고르는 일과 줄 세우는 일이 한 번에 끝난다.
 */
@Index(['room', 'id'])
export class ChatMessageModel extends BaseModel {
    @ManyToOne(() => ChatRoomModel, (room) => room.messages, {
        onDelete: 'CASCADE',
        nullable: false,
    })
    room: ChatRoomModel;

    /**
     * 보낸 사람. **SYSTEM 메시지는 보낸 사람이 없으므로 null 을 허용한다.**
     *
     * onDelete: 'SET NULL' 인 이유
     *   상대가 탈퇴하면 users 에서 줄이 사라진다. CASCADE 로 두면
     *   **그 사람이 보낸 말이 내 대화창에서 통째로 증발한다.**
     *   내가 나눈 대화가 나 혼자 말한 것처럼 남는 건 사고에 가깝다.
     *   보낸 사람만 비우고 말은 남긴다. (시안: 탈퇴한 친구일 때.png)
     */
    @ManyToOne(() => UsersModel, { onDelete: 'SET NULL', nullable: true })
    sender: UsersModel | null;

    @Column({
        type: 'enum',
        enum: Object.values(ChatMessageType),
        default: ChatMessageType.TEXT,
    })
    type: ChatMessageType;

    /** 글 내용. 사진만 보낸 메시지는 null. */
    @Column({ type: 'varchar', nullable: true })
    content: string | null;

    /**
     * 사진의 창고(GCS) 경로. 예) chats/3f9a-1b2c.png
     *
     * image_model 테이블을 쓰지 않고 여기에 직접 둔 이유
     *   image_model 은 이미 post 와 user 두 개의 외래키를 달고 있고,
     *   둘 다 nullable 이라 "이 사진이 누구 것인지"가 이미 흐릿하다.
     *   메시지 사진은 **항상 그 메시지 한 개에만** 붙고 개수도 1장이다.
     *   세 번째 nullable 외래키를 더하는 것보다 칸 하나가 명확하다.
     *
     * DB에는 짧은 경로만 저장하고, 앱에 내려줄 때 창고 주소를 앞에 붙인다.
     * (개발용/운영용 버킷이 달라서 전체 주소를 저장하면 환경을 옮길 때 전부 깨진다)
     */
    @Column({ type: 'varchar', nullable: true })
    @Transform(({ value }) => {
        if (!value) return value;
        if (typeof value === 'string' && value.startsWith('http')) return value;

        return `https://storage.googleapis.com/${process.env[ENV_GCS_BUCKET_KEY]}/${value}`;
    })
    imagePath: string | null;
}
