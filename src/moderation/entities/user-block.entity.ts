import { Entity, Index, ManyToOne } from "typeorm";
import { BaseModel } from "src/common/entity/base.entity";
import { UsersModel } from "src/users/entities/users.entity";

/**
 * 차단 한 건. (기획서 FE-Block-001 / BE-Block-001)
 *
 * users 테이블에 목록을 몰아넣으면 안 되는 이유
 *   예전 코드는 `blockedUserIds` 라는 칸 하나에 "3,7,12" 처럼 이어붙여 저장했다.
 *   그러면 세 가지가 막힌다.
 *     · **"나를 차단한 사람"을 찾을 수 없다** — 전 회원을 다 뒤져야 한다
 *       기획서 BE-Block-001 이 요구하는 '서로 안 보이게'가 불가능해진다
 *     · 차단한 날짜를 둘 자리가 없다
 *     · 글자 검색이라 인덱스(찾기를 빠르게 해주는 색인)를 못 쓴다
 */
@Entity()
// 같은 사람을 두 번 차단하지 못하게 막는다.
@Index(['blocker', 'blocked'], { unique: true })
export class UserBlockModel extends BaseModel {
    /** 차단한 사람 */
    @ManyToOne(() => UsersModel, { onDelete: 'CASCADE', nullable: false })
    blocker: UsersModel;

    /** 차단당한 사람 */
    @ManyToOne(() => UsersModel, { onDelete: 'CASCADE', nullable: false })
    blocked: UsersModel;
}
