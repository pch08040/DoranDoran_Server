import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * 이야기(채팅) 테이블 3장을 만든다. (Phase 6)
 *
 *   chat_room_model         방 자체 + 목록에 보여줄 마지막 대화 미리보기
 *   chat_room_member_model  그 사람이 그 방을 어떻게 보고 있는지 (즐겨찾기·나감·읽은 위치)
 *   chat_message_model      메시지
 *
 * 기존 테이블은 **하나도 건드리지 않는다.** up() 안이 전부 CREATE 라 잃을 데이터가 없다.
 *
 * 눈으로 확인한 것 (이 단계를 건너뛰지 말 것 — DEV_GUIDE 11장)
 *   · up() 안에 DROP TABLE / DROP COLUMN 이 0건
 *   · chat_room_model."pairKey" 에 **UNIQUE** 인덱스
 *     → 같은 두 사람 사이에 방이 두 개 생기는 것을 DB가 막는다
 *   · chat_message_model."senderId" 는 **ON DELETE SET NULL**
 *     → 상대가 탈퇴해도 그 사람이 보낸 말은 대화창에 남는다
 *       (CASCADE 였다면 내 대화 기록의 절반이 통째로 사라진다)
 *   · 시각 컬럼이 전부 TIMESTAMP WITH TIME ZONE (= timestamptz)
 *     → BaseModel 이 강제하고 있어 자동으로 맞았다
 */
export class AddChatTables1788263051455 implements MigrationInterface {
    name = 'AddChatTables1788263051455'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "chat_room_member_model" ("id" SERIAL NOT NULL, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "isFavorite" boolean NOT NULL DEFAULT false, "leftAt" TIMESTAMP WITH TIME ZONE, "clearedMessageId" integer NOT NULL DEFAULT '0', "lastReadMessageId" integer NOT NULL DEFAULT '0', "roomId" integer NOT NULL, "userId" integer NOT NULL, CONSTRAINT "PK_d7f895ab56de594619d6ebe52bd" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_828b84fbd5c36c1759f6ddcc48" ON "chat_room_member_model" ("userId", "leftAt") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_1dbb48fba1801508abad5d8217" ON "chat_room_member_model" ("roomId", "userId") `);
        await queryRunner.query(`CREATE TYPE "public"."chat_message_model_type_enum" AS ENUM('TEXT', 'IMAGE', 'SYSTEM')`);
        await queryRunner.query(`CREATE TABLE "chat_message_model" ("id" SERIAL NOT NULL, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "type" "public"."chat_message_model_type_enum" NOT NULL DEFAULT 'TEXT', "content" character varying, "imagePath" character varying, "roomId" integer NOT NULL, "senderId" integer, CONSTRAINT "PK_1eff0e5f58da7054515fa4a6082" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE INDEX "IDX_08b4fec89d3a10b8699f53f719" ON "chat_message_model" ("roomId", "id") `);
        await queryRunner.query(`CREATE TABLE "chat_room_model" ("id" SERIAL NOT NULL, "updatedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "createdAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(), "pairKey" character varying NOT NULL, "lastMessageAt" TIMESTAMP WITH TIME ZONE, "lastMessageText" character varying, CONSTRAINT "PK_0b8e49ece1230e0dd3696f6e6f2" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_1b981f666363315e2a073ed461" ON "chat_room_model" ("pairKey") `);
        await queryRunner.query(`ALTER TABLE "chat_room_member_model" ADD CONSTRAINT "FK_02cfe6ddcf9ff626de6354fc149" FOREIGN KEY ("roomId") REFERENCES "chat_room_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "chat_room_member_model" ADD CONSTRAINT "FK_9d7ca2f758cc7bcc7cb70ebebee" FOREIGN KEY ("userId") REFERENCES "users_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "chat_message_model" ADD CONSTRAINT "FK_43e022ec86c90bbd85c12a87b5e" FOREIGN KEY ("roomId") REFERENCES "chat_room_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "chat_message_model" ADD CONSTRAINT "FK_eaf85440fcfbe1ce422b0ec029a" FOREIGN KEY ("senderId") REFERENCES "users_model"("id") ON DELETE SET NULL ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "chat_message_model" DROP CONSTRAINT "FK_eaf85440fcfbe1ce422b0ec029a"`);
        await queryRunner.query(`ALTER TABLE "chat_message_model" DROP CONSTRAINT "FK_43e022ec86c90bbd85c12a87b5e"`);
        await queryRunner.query(`ALTER TABLE "chat_room_member_model" DROP CONSTRAINT "FK_9d7ca2f758cc7bcc7cb70ebebee"`);
        await queryRunner.query(`ALTER TABLE "chat_room_member_model" DROP CONSTRAINT "FK_02cfe6ddcf9ff626de6354fc149"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1b981f666363315e2a073ed461"`);
        await queryRunner.query(`DROP TABLE "chat_room_model"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_08b4fec89d3a10b8699f53f719"`);
        await queryRunner.query(`DROP TABLE "chat_message_model"`);
        await queryRunner.query(`DROP TYPE "public"."chat_message_model_type_enum"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1dbb48fba1801508abad5d8217"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_828b84fbd5c36c1759f6ddcc48"`);
        await queryRunner.query(`DROP TABLE "chat_room_member_model"`);
    }

}
