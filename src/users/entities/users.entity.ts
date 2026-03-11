import { Exclude } from "class-transformer";
import { IsEmail, IsOptional, IsPhoneNumber, IsString, Length, length } from "class-validator";
import { BaseModel } from "src/common/entity/base.entity";
import { emailValidationMessage } from "src/common/validation-message/email-validation.message";
import { lengthValidationMessage } from "src/common/validation-message/length-validation.message";
import { stringValidationMessage } from "src/common/validation-message/string-validation.message";
import { Column, Entity, OneToMany, OneToOne } from "typeorm";
import { RolesEnum } from "../const/roles.const";
import { GenderEnum } from "../const/gender.const";
import { PostsModel } from "src/posts/entity/posts.entity";

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

    // 나이
    @Column({
        nullable: true,
    })
    @IsString({
        message: stringValidationMessage,
    })
    age: string;

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
    @Column(
        'simple-array',
        {
            nullable: false,
            default: "/public/users/basicProfile.png",
        })
    profileImages: string[] = ["/public/users/basicProfile.png"];

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