import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialSchema1785663622389 implements MigrationInterface {
    name = 'InitialSchema1785663622389'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TYPE "public"."users_model_gender_enum" AS ENUM('남성', '여성')`);
        await queryRunner.query(`CREATE TYPE "public"."users_model_role_enum" AS ENUM('ADMIN', 'USER')`);
        await queryRunner.query(`CREATE TABLE "users_model" ("id" SERIAL NOT NULL, "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "phoneNumber" character varying NOT NULL, "firstName" character varying(10), "lastName" character varying NOT NULL DEFAULT '도란이', "gender" "public"."users_model_gender_enum", "age" character varying, "area" character varying, "bio" character varying, "reportCount" integer NOT NULL DEFAULT '0', "blockedUserIds" text, "isProfileCompleted" boolean NOT NULL DEFAULT false, "role" "public"."users_model_role_enum" NOT NULL DEFAULT 'USER', CONSTRAINT "UQ_b64ea25b84c7fbec30988c56384" UNIQUE ("phoneNumber"), CONSTRAINT "PK_1355f66d5ebddb2449c566571c8" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "image_model" ("id" SERIAL NOT NULL, "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "path" character varying NOT NULL, "order" integer NOT NULL DEFAULT '0', "type" integer NOT NULL, "postId" integer, "userId" integer, CONSTRAINT "PK_05aa8703890985ec0bb38428699" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE TABLE "posts_model" ("id" SERIAL NOT NULL, "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "content" character varying NOT NULL, "authorId" integer NOT NULL, CONSTRAINT "PK_d70f19613eb641c94bb122c4397" PRIMARY KEY ("id"))`);
        await queryRunner.query(`ALTER TABLE "image_model" ADD CONSTRAINT "FK_40cd89c6655ec7b102842feacab" FOREIGN KEY ("postId") REFERENCES "posts_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "image_model" ADD CONSTRAINT "FK_f583ea1e9a54b229881afb0fc06" FOREIGN KEY ("userId") REFERENCES "users_model"("id") ON DELETE CASCADE ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "posts_model" ADD CONSTRAINT "FK_c8b7f084ae29a7104846f1bec05" FOREIGN KEY ("authorId") REFERENCES "users_model"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "posts_model" DROP CONSTRAINT "FK_c8b7f084ae29a7104846f1bec05"`);
        await queryRunner.query(`ALTER TABLE "image_model" DROP CONSTRAINT "FK_f583ea1e9a54b229881afb0fc06"`);
        await queryRunner.query(`ALTER TABLE "image_model" DROP CONSTRAINT "FK_40cd89c6655ec7b102842feacab"`);
        await queryRunner.query(`DROP TABLE "posts_model"`);
        await queryRunner.query(`DROP TABLE "image_model"`);
        await queryRunner.query(`DROP TABLE "users_model"`);
        await queryRunner.query(`DROP TYPE "public"."users_model_role_enum"`);
        await queryRunner.query(`DROP TYPE "public"."users_model_gender_enum"`);
    }

}
