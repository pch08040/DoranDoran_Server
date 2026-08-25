import { Exclude, Transform } from "class-transformer";
import { IsInt, IsOptional, IsPhoneNumber, IsString } from "class-validator";
import { BaseModel } from "src/common/entity/base.entity";
import { emailValidationMessage } from "src/common/validation-message/email-validation.message";
import { lengthValidationMessage } from "src/common/validation-message/length-validation.message";
import { stringValidationMessage } from "src/common/validation-message/string-validation.message";
import { Column, Entity, OneToMany, OneToOne } from "typeorm";
import { RolesEnum } from "../const/roles.const";
import { GenderEnum } from "../const/gender.const";
import { PostsModel } from "src/posts/entity/posts.entity";
import { ImageModel, ImageModelType } from "src/common/entity/image.entity";
import { ENV_GCS_BUCKET_KEY } from "src/common/const/env-keys.const";
import { DEFAULT_PROFILE_OBJECT } from "src/common/const/path.const";
import { UserSettingsModel } from "./user-settings.entity";

@Entity()
export class UsersModel extends BaseModel {

    // 핸드폰 번호
    @Column({
        unique: true,
    })
    @IsPhoneNumber('KR', {
        message: '정확한 번호를 입력해주세요!',
    })
    phoneNumber: string;

    // 선택된 첫 번째 이름
    @Column({
        length: 10,
        nullable: true,
    })
    @IsString({
        message: stringValidationMessage,
    })
    firstName: string;

    // 두 번째 이름(고정값 : 도란이)
    @Column({ default: '도란이' })
    @IsString({
        message: stringValidationMessage,
    })
    lastName: string;

    // 성별
    @Column({
        type: 'enum',
        enum: Object.values(GenderEnum),
        nullable: true,
    })
    @IsString()
    gender: GenderEnum;

    /**
     * 나이. **숫자여야 한다.**
     *
     * 예전에는 문자열이었는데, 그러면 '만날 친구 설정'의 나이 범위 필터가
     * 사전순으로 비교돼 통째로 잘못 동작한다.
     *   '5' BETWEEN '19' AND '99'  →  참   ('5' > '1' 이므로)
     * 즉 19~99살을 고른 사용자에게 5살이 후보로 뜬다.
     */
    @Column({
        type: 'int',
        nullable: true,
    })
    @IsInt({ message: '나이를 확인해주세요.' })
    age: number;

    // 지역
    @Column({
        nullable: true,
    })
    @IsString({
        message: stringValidationMessage,
    })
    area: string;

    // 자기소개
    @Column({
        nullable: true,
    })
    @IsOptional()
    @IsString({
        message: stringValidationMessage,
    })
    bio?: string;

    // 프로필 사진
    @OneToMany(() => ImageModel, (image) => image.user)
    // 사진을 한 장도 등록하지 않았다면 기본 프로필을 대신 내려준다.
    @Transform(({ value }) => {
        if (!value || value.length === 0) {
            return [{
                path: `https://storage.googleapis.com/${process.env[ENV_GCS_BUCKET_KEY]}/${DEFAULT_PROFILE_OBJECT}`,
                type: ImageModelType.USER_IMAGE,
            }];
        }

        return value;
    })
    images: ImageModel[];
    
    // 신고된 횟수
    @Column({ default: 0 })
    reportCount: number;

    // 차단된 유저 아이디
    @Column('simple-array', { nullable: true })
    @IsString({
        message: stringValidationMessage,
    })
    blockedUserIds: string[];

    // 게시글
    @OneToMany(() => PostsModel, (post) => post.author)
    posts: PostsModel[];

    // 프로필 작성 완료 여부
    @Column({ default: false })
    isProfileCompleted: boolean;

    /**
     * 마지막으로 서비스를 쓴 시각.
     *
     * 홈의 친구 목록을 **최신 접속순**으로 정렬하는 데 쓴다. (기획서 BE-Setting-003)
     * createdAt(가입일)으로 정렬하면 오래된 회원이 영원히 아래에 깔려서
     * 실제로 활동 중인 사람이 안 보인다.
     *
     * updatedAt 을 쓰면 안 되는 이유: 프로필을 고칠 때만 바뀌므로
     * '접속'과는 다른 값이다. 앱을 켜기만 해도 갱신돼야 한다.
     */
    // timestamptz — 시간대를 포함한 절대 시각. base.entity.ts 의 설명 참고.
    @Column({ type: 'timestamptz', nullable: true })
    lastActiveAt: Date | null;

    /**
     * 만날 친구 설정. 유저 한 명당 하나만 있다.
     *
     * users 안에 컬럼으로 넣지 않고 테이블을 나눈 이유
     *   설정은 앞으로 계속 늘어난다(알림, 미리보기, 다크모드...).
     *   그때마다 users 에 컬럼이 붙으면, 유저를 한 명 읽을 때마다
     *   쓰지도 않는 설정값을 전부 같이 읽게 된다.
     */
    @OneToOne(() => UserSettingsModel, (settings) => settings.user)
    settings: UserSettingsModel;

    // 사용자 권한
    @Column({
        type: 'enum',
        enum: Object.values(RolesEnum),
        default: RolesEnum.USER,
    })
    role: RolesEnum;
}

/**
 * 첫번째 이름(최대 10자, 이름 리스트에서 선택하면 입력됨),
 * 두번쨰 이름(고정값),
 * 전화번호(유니크, 비밀번호 대신 전화번호로 체크),
 * 성별(최대 2자),
 * 나이(최대 3자),
 * 지역(최대 5자),
 * 자기소개(최대 30자),
 * 사진(3장),
 * 게시물(2일뒤 자동삭제) {
 *  사진(최대 1장),
 *  게시글(최대 20자),
 *  게시글생성날짜,
 * }
 * 신고받은 횟수,
 * 차단한 유저 리스트{
 *  유저1,
 *  유저2,
 * }
 * 유저 생성 날짜,
 * 유저 정보수정 날짜,
 * 프로필 작성 완료 여부
 * 
 */