import { CreateDateColumn, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

/**
 * 모든 테이블이 공통으로 갖는 항목.
 *
 * ⚠️ 시각은 반드시 `timestamptz` 로 둘 것.
 *
 *   예전에는 타입을 안 적어서 `timestamp`(시간대 없음)로 만들어졌다.
 *   그 타입은 "몇 시"라는 숫자만 저장하고 **어느 시간대인지는 버린다.**
 *   그래서 쓰는 쪽이 다르면 같은 순간이 다른 값으로 들어간다.
 *
 *   실제로 이런 일이 있었다 — 한 유저의 같은 순간이
 *     updatedAt    09:10   (PostgreSQL DEFAULT now() → UTC)
 *     lastActiveAt 18:10   (TypeORM new Date()      → KST)
 *   9시간 차이로 기록돼 최신순 정렬이 뒤섞였다.
 *
 *   `timestamptz` 는 절대 시각을 저장하므로 누가 어느 시간대에서 쓰든 같은 값이 된다.
 *   배포하면 서버는 UTC(Cloud Run)에서 도는데 개발은 KST 라서, 이걸 안 맞추면
 *   배포 직후 기존 데이터가 전부 9시간 어긋나 보인다.
 */
export abstract class BaseModel {
    @PrimaryGeneratedColumn()
    id: number;

    @UpdateDateColumn({ type: 'timestamptz' })
    updatedAt: Date;

    @CreateDateColumn({ type: 'timestamptz' })
    createdAt: Date;
}
