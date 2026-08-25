import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * 모든 시각 컬럼을 timestamptz(시간대를 포함한 절대 시각)로 바꾼다.
 *
 * 왜 필요했나
 *   기존 타입 timestamp 는 "몇 시"라는 숫자만 저장하고 시간대를 버린다.
 *   그래서 **쓰는 쪽이 다르면 같은 순간이 다른 값으로** 들어갔다.
 *
 *   실제 데이터에서 확인된 것 (한 유저의 같은 순간)
 *     updatedAt    09:10   ← PostgreSQL DEFAULT now()  (컨테이너가 UTC)
 *     lastActiveAt 18:10   ← TypeORM new Date()        (맥이 KST)
 *
 *   그 결과 '최신 접속순' 정렬이 뒤섞였고,
 *   배포하면(Cloud Run 은 UTC) 기존 데이터가 전부 9시간 어긋나 보이게 된다.
 *   Phase 5 의 '게시글 2일 뒤 자동 삭제'도 9시간씩 틀어진다.
 *
 * ⚠️ 일괄 변환하면 안 된다.
 *   `ALTER ... TYPE timestamptz` 는 기존 값을 **세션 시간대로 해석**한다.
 *   컨테이너가 UTC 이므로 그냥 바꾸면 TypeORM 이 쓴 KST 값들이 9시간 밀린다.
 *   그래서 컬럼마다 원래 시간대를 지정해 변환한다.
 *     createdAt / updatedAt → UTC        (PostgreSQL 이 씀)
 *     lastActiveAt          → Asia/Seoul (TypeORM 이 씀)
 */
export class UseTimestamptz1787651769082 implements MigrationInterface {
    name = 'UseTimestamptz1787651769082'

    /** createdAt / updatedAt 을 가진 테이블들 */
    private readonly tables = [
        'users_model',
        'image_model',
        'posts_model',
        'user_settings_model',
    ];

    public async up(queryRunner: QueryRunner): Promise<void> {
        for (const table of this.tables) {
            for (const column of ['createdAt', 'updatedAt']) {
                await queryRunner.query(`
                    ALTER TABLE "${table}"
                    ALTER COLUMN "${column}" TYPE timestamptz
                    USING "${column}" AT TIME ZONE 'UTC'
                `);
            }
        }

        // TypeORM 이 직접 쓴 값이라 한국 시간으로 해석해야 한다.
        await queryRunner.query(`
            ALTER TABLE "users_model"
            ALTER COLUMN "lastActiveAt" TYPE timestamptz
            USING "lastActiveAt" AT TIME ZONE 'Asia/Seoul'
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            ALTER TABLE "users_model"
            ALTER COLUMN "lastActiveAt" TYPE timestamp
            USING "lastActiveAt" AT TIME ZONE 'Asia/Seoul'
        `);

        for (const table of this.tables) {
            for (const column of ['createdAt', 'updatedAt']) {
                await queryRunner.query(`
                    ALTER TABLE "${table}"
                    ALTER COLUMN "${column}" TYPE timestamp
                    USING "${column}" AT TIME ZONE 'UTC'
                `);
            }
        }
    }
}
