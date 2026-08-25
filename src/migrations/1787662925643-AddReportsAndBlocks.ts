import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * 신고·차단 테이블을 만들고, users 의 죽은 컬럼 2개를 걷어낸다. (Phase 4)
 *
 * 지우는 컬럼과 그 이유
 *   users.reportCount    누적 횟수 '숫자 하나'만 있어서 누가·언제·왜 신고했는지 알 수 없었다.
 *                        한 사람이 세 번 신고해도 3회로 세어졌다.
 *   users.blockedUserIds "3,7,12" 처럼 한 칸에 몰아넣어서
 *                        **"나를 차단한 사람"을 찾을 수 없었다.**
 *                        기획서 BE-Block-001 의 '서로 안 보이게'가 불가능했다.
 *
 * 둘 다 코드 어디에서도 쓰이지 않던 컬럼이라 지워도 잃을 데이터가 없다.
 *
 * unique 인덱스(중복을 막는 색인)를 거는 이유
 *   같은 사람을 두 번 신고·차단하지 못하게 **DB 차원에서** 막는다.
 *   앱에서만 막으면 버튼을 빠르게 두 번 눌렀을 때 두 건이 쌓인다.
 */
export class AddReportsAndBlocks1787662925643 implements MigrationInterface {
    name = 'AddReportsAndBlocks1787662925643'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."user_report_model_reason_enum" AS ENUM('PRIVACY_LEAK', 'SEXUAL_EXPLOITATION', 'DRUG_TRADE', 'INAPPROPRIATE_MEETING', 'MONEY_REQUEST', 'PROFILE_THEFT', 'OFFENSIVE_CONTENT', 'PHISHING', 'ROMANCE_SCAM', 'SEXTORTION')`);
        await queryRunner.query(`CREATE TABLE "user_report_model" ("id" SERIAL NOT NULL, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "reason" "public"."user_report_model_reason_enum" NOT NULL, "reporterId" integer NOT NULL, "reportedId" integer NOT NULL, CONSTRAINT "PK_6a3ab7bbdb4c596360cc1c2189f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_beeb2301b52ccbd92eb67268d7" ON "user_report_model" ("reporterId", "reportedId") `);
        await queryRunner.query(`CREATE TABLE "user_block_model" ("id" SERIAL NOT NULL, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "blockerId" integer NOT NULL, "blockedId" integer NOT NULL, CONSTRAINT "PK_1b4a89e12305ba6fb5d003e488f" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_abdf9eda6f0c3d3a9d5f1d2f87" ON "user_block_model" ("blockerId", "blockedId") `);
        await queryRunner.query(`ALTER TABLE "users_model" DROP COLUMN "reportCount"`);
        await queryRunner.query(`ALTER TABLE "users_model" DROP COLUMN "blockedUserIds"`);
        await queryRunner.query(`ALTER TABLE "user_report_model" ADD CONSTRAINT "FK_974a7551724f12e086d73a8ebbd" FOREIGN KEY ("reporterId") REFERENCES "users_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_report_model" ADD CONSTRAINT "FK_c0f0e1409af6230e3ee37fe1348" FOREIGN KEY ("reportedId") REFERENCES "users_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_block_model" ADD CONSTRAINT "FK_6944cbde7341f9717c4c226470e" FOREIGN KEY ("blockerId") REFERENCES "users_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "user_block_model" ADD CONSTRAINT "FK_2d96a236702f8b70be80f947426" FOREIGN KEY ("blockedId") REFERENCES "users_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "user_block_model" DROP CONSTRAINT "FK_2d96a236702f8b70be80f947426"`);
        await queryRunner.query(`ALTER TABLE "user_block_model" DROP CONSTRAINT "FK_6944cbde7341f9717c4c226470e"`);
        await queryRunner.query(`ALTER TABLE "user_report_model" DROP CONSTRAINT "FK_c0f0e1409af6230e3ee37fe1348"`);
        await queryRunner.query(`ALTER TABLE "user_report_model" DROP CONSTRAINT "FK_974a7551724f12e086d73a8ebbd"`);
        await queryRunner.query(`ALTER TABLE "users_model" ADD "blockedUserIds" text`);
        await queryRunner.query(`ALTER TABLE "users_model" ADD "reportCount" integer NOT NULL DEFAULT '0'`);
        await queryRunner.query(`DROP INDEX "public"."IDX_abdf9eda6f0c3d3a9d5f1d2f87"`);
        await queryRunner.query(`DROP TABLE "user_block_model"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_beeb2301b52ccbd92eb67268d7"`);
        await queryRunner.query(`DROP TABLE "user_report_model"`);
        await queryRunner.query(`DROP TYPE "public"."user_report_model_reason_enum"`);
    }

}
