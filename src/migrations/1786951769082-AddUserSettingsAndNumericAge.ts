import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * 만날 친구 설정 테이블 추가 + 나이를 문자열에서 숫자로 전환.
 *
 * ⚠️ 자동 생성된 코드를 그대로 쓰면 안 됐다.
 *   TypeORM 은 varchar → int 변환 방법을 모르기 때문에 이렇게 만들어준다.
 *     ALTER TABLE users_model DROP COLUMN "age";
 *     ALTER TABLE users_model ADD "age" integer;
 *   즉 **기존 나이를 전부 지우고 빈 칸으로 새로 만든다.**
 *   그래서 USING 절을 쓴 변환문으로 직접 바꿨다.
 */
export class AddUserSettingsAndNumericAge1786951769082 implements MigrationInterface {
    name = 'AddUserSettingsAndNumericAge1786951769082'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1) 만날 친구 설정 테이블
        await queryRunner.query(`CREATE TYPE "public"."user_settings_model_gender_enum" AS ENUM('남성', '여성')`);
        await queryRunner.query(`CREATE TABLE "user_settings_model" ("id" SERIAL NOT NULL, "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "area" character varying, "gender" "public"."user_settings_model_gender_enum", "minAge" integer NOT NULL DEFAULT '19', "maxAge" integer NOT NULL DEFAULT '99', "userId" integer, CONSTRAINT "REL_7655e861ae7a72ed23f1f3e0a5" UNIQUE ("userId"), CONSTRAINT "PK_e310d7b19df3a047e19296dccc0" PRIMARY KEY ("id"))`);

        // 2) 최신 접속순 정렬에 쓸 컬럼
        await queryRunner.query(`ALTER TABLE "users_model" ADD "lastActiveAt" TIMESTAMP`);

        /**
         * 3) 나이를 숫자로 바꾼다. **기존 값을 유지한다.**
         *
         * USING 절은 '기존 값을 어떻게 새 타입으로 바꿀지'를 알려주는 부분이다.
         *   NULLIF(regexp_replace(age, '[^0-9]', '', 'g'), '')::integer
         *    · regexp_replace : 숫자가 아닌 글자를 전부 지운다 ('27살' → '27')
         *    · NULLIF(x, '')  : 남은 게 없으면 NULL 로 (''::integer 는 에러가 난다)
         *
         * 그냥 age::integer 로 쓰면 숫자가 아닌 값이 하나라도 있을 때
         * 마이그레이션 전체가 중간에 실패한다.
         */
        await queryRunner.query(`
            ALTER TABLE "users_model"
            ALTER COLUMN "age" TYPE integer
            USING NULLIF(regexp_replace("age", '[^0-9]', '', 'g'), '')::integer
        `);

        await queryRunner.query(`ALTER TABLE "user_settings_model" ADD CONSTRAINT "FK_7655e861ae7a72ed23f1f3e0a5e" FOREIGN KEY ("userId") REFERENCES "users_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_settings_model" DROP CONSTRAINT "FK_7655e861ae7a72ed23f1f3e0a5e"`);

        // 되돌릴 때도 값을 유지한다. 숫자 → 문자열은 항상 가능하다.
        await queryRunner.query(`
            ALTER TABLE "users_model"
            ALTER COLUMN "age" TYPE character varying
            USING "age"::character varying
        `);

        await queryRunner.query(`ALTER TABLE "users_model" DROP COLUMN "lastActiveAt"`);
        await queryRunner.query(`DROP TABLE "user_settings_model"`);
        await queryRunner.query(`DROP TYPE "public"."user_settings_model_gender_enum"`);
    }
}
