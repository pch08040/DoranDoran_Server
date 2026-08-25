import { Exclude } from "class-transformer";
import { Column, Entity, JoinColumn, OneToOne } from "typeorm";
import { BaseModel } from "src/common/entity/base.entity";
import { UsersModel } from "./users.entity";
import { GenderEnum } from "../const/gender.const";

/** 만날 친구 나이 범위의 기본값 */
export const DEFAULT_MIN_AGE = 19;
export const DEFAULT_MAX_AGE = 99;

/**
 * 유저 한 명의 설정. **1:1** 관계다.
 *
 * 지금은 '만날 친구 설정'만 들어있고,
 * Phase 8에서 알림 설정(푸시·미리보기)이 여기에 추가된다.
 *
 * ⚠️ null 의 뜻이 '값 없음'이 아니라 **'전체'** 라는 점에 주의.
 *   지역이 null 이면 "지역을 안 정했다"가 아니라 "어느 지역이든 좋다"는 뜻이다.
 *   기획서 FE-Setting-002 가 성별에 '전체' 선택지를 요구하는데,
 *   이걸 표현하려면 '아무 조건 없음'을 담을 값이 필요하다.
 */
@Entity()
export class UserSettingsModel extends BaseModel {
    /**
     * 이 설정의 주인.
     *
     * @JoinColumn 은 '외래키를 이 테이블에 두겠다'는 표시다.
     * 1:1 관계는 어느 쪽에 키를 둘지 정해줘야 하는데,
     * 설정이 유저에 딸린 것이므로 설정 쪽에 둔다.
     */
    // @Exclude() — 응답에는 싣지 않는다.
    // 설정을 물어본 사람이 곧 주인이라 유저 정보를 되돌려줄 이유가 없고,
    // 그대로 두면 설정 하나 읽을 때마다 프로필 사진까지 딸려 나간다.
    @Exclude()
    @OneToOne(() => UsersModel, (user) => user.settings, { onDelete: 'CASCADE' })
    @JoinColumn()
    user: UsersModel;

    /**
     * 만나고 싶은 지역. null 이면 전체.
     * 값은 users.area 와 같은 목록을 쓴다. (서울, 경기, 부산, ...)
     */
    // `string | null` 만 적으면 TypeORM 이 타입을 못 알아본다.
    // (컴파일 뒤에는 Object 로만 보여서 "Data type Object is not supported" 로 막힌다)
    @Column({ type: 'varchar', nullable: true })
    area: string | null;

    /** 만나고 싶은 성별. null 이면 전체 */
    @Column({
        type: 'enum',
        enum: Object.values(GenderEnum),
        nullable: true,
    })
    gender: GenderEnum | null;

    /**
     * 나이 범위. 기본 19~99.
     *
     * 19살부터인 이유: 익명 채팅이라 미성년자가 섞이면
     * 앱스토어 심사와 법적 책임 문제가 생긴다. (2026-08-17 결정)
     */
    @Column({ type: 'int', default: DEFAULT_MIN_AGE })
    minAge: number;

    @Column({ type: 'int', default: DEFAULT_MAX_AGE })
    maxAge: number;
}
