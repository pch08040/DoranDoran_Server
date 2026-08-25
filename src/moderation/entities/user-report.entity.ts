import { Column, Entity, Index, ManyToOne } from "typeorm";
import { BaseModel } from "src/common/entity/base.entity";
import { UsersModel } from "src/users/entities/users.entity";
import { ReportReason } from "../const/report-reason.const";

/**
 * 신고 한 건. (기획서 FE-Report-001 / BE-Report-001)
 *
 * users 테이블에 '신고 횟수' 숫자만 두면 안 되는 이유
 *   예전 코드가 그랬다. `users.reportCount = 3` 처럼 숫자만 있었다.
 *   그러면 **누가·언제·왜 신고했는지가 없다.** 그래서
 *     · 한 사람이 3번 신고해도 3회로 세어져, 한 명이 남을 쫓아낼 수 있다
 *     · "저 왜 제재됐나요?" 라는 문의에 답할 근거가 없다
 *   신고는 건별로 남겨야 한다.
 */
@Entity()
// 같은 사람을 두 번 신고하지 못하게 막는다.
// 이걸 DB 차원에서 막지 않으면, 앱에서 버튼을 두 번 눌렀을 때 두 건이 쌓인다.
@Index(['reporter', 'reported'], { unique: true })
export class UserReportModel extends BaseModel {
    /** 신고한 사람 */
    @ManyToOne(() => UsersModel, { onDelete: 'CASCADE', nullable: false })
    reporter: UsersModel;

    /** 신고당한 사람 */
    @ManyToOne(() => UsersModel, { onDelete: 'CASCADE', nullable: false })
    reported: UsersModel;

    @Column({ type: 'enum', enum: ReportReason })
    reason: ReportReason;
}
