import { MigrationInterface, QueryRunner } from "typeorm";

/**
 * 목록 조회를 빠르게 하는 인덱스(색인) 추가.
 *
 * 인덱스가 없으면 조건에 맞는 사람을 찾을 때 **회원 전체를 한 명씩 훑는다.**
 * 지금은 몇십 명이라 티가 안 나지만, 수만 명이 되면 홈 화면이 눈에 띄게 느려진다.
 *
 * 어디에 왜 거는가
 *   users(isProfileCompleted, area, gender, age)
 *     홈 친구 목록과 와글와글 피드가 이 네 칸으로 사람을 거른다.
 *     순서가 중요하다. 앞에 올수록 후보를 많이 줄여야 효율이 좋다.
 *   users(lastActiveAt)
 *     '최신 접속순' 정렬용. 정렬 기준 칸에도 인덱스가 있어야 줄 세우기가 빨라진다.
 *   posts(createdAt)
 *     피드는 항상 '만료 안 된 글을 최신순으로' 읽는다. 거르기와 정렬을 한 번에 끝낸다.
 *
 * ⚠️ 이 마이그레이션은 **데이터를 건드리지 않는다.** 색인만 만든다.
 *   되돌려도(down) 잃는 데이터가 없다.
 *   다만 테이블이 아주 커진 뒤에는 인덱스 생성 중 쓰기가 잠깐 막히므로,
 *   운영에서는 CONCURRENTLY 옵션을 검토해야 한다. (지금은 데이터가 적어 불필요)
 */
export class AddSearchIndexes1787760363312 implements MigrationInterface {
    name = 'AddSearchIndexes1787760363312'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE INDEX "IDX_1882ab31dbc4f4eff561ee9803" ON "posts_model" ("createdAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_e70e1648576d69709ca4457a2b" ON "users_model" ("lastActiveAt") `);
        await queryRunner.query(`CREATE INDEX "IDX_0bb2ffa8c618f7bab5c18b3337" ON "users_model" ("isProfileCompleted", "area", "gender", "age") `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP INDEX "public"."IDX_0bb2ffa8c618f7bab5c18b3337"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_e70e1648576d69709ca4457a2b"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_1882ab31dbc4f4eff561ee9803"`);
    }

}
