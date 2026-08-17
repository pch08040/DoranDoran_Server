import { Column, Entity, ManyToOne } from "typeorm";
import { BaseModel } from "./base.entity";
import { IsEnum, IsInt, IsOptional, IsString } from "class-validator";
import { Transform } from "class-transformer";
import { PostsModel } from "src/posts/entity/posts.entity";
import { UsersModel } from "src/users/entities/users.entity";
import { ENV_GCS_BUCKET_KEY } from "../const/env-keys.const";

export enum ImageModelType {
    POST_IMAGE,
    USER_IMAGE,
    TEMP_IMAGE,
}

@Entity()
export class ImageModel extends BaseModel {
    /**
     * 창고(GCS) 안에서의 파일 경로. 예) users/3f9a-1b2c.png
     *
     * DB에는 이 짧은 경로만 저장하고, 앱에 내려줄 때 앞에 창고 주소를 붙여준다.
     * 전체 주소를 통째로 저장하지 않는 이유는, 개발용/운영용 버킷이 다르기 때문이다.
     * (경로만 저장해두면 어느 환경에서 읽든 그 환경의 버킷 주소가 붙는다)
     */
    @Column()
    @IsString()
    @Transform(({ value }) => {
        if (!value) return value;

        // 이미 전체 주소면 그대로 둔다 (기본 프로필처럼 미리 만들어 넣는 경우)
        if (typeof value === 'string' && value.startsWith('http')) return value;

        return `https://storage.googleapis.com/${process.env[ENV_GCS_BUCKET_KEY]}/${value}`;
    })
    path: string;

    @Column({ default: 0 })
    @IsInt()
    @IsOptional()
    order: number; // 프로필 3장의 순서를 정하기 위해 필요

    @Column({ enum: ImageModelType })
    @IsEnum(ImageModelType)
    type: ImageModelType;

    // 포스트와의 관계(게시물은 1장이라도 1:N 혹인 1:1로 연결)
    @ManyToOne(() => PostsModel, (post) => post.images, { onDelete: 'CASCADE' })
    post?: PostsModel;

    // 유저와의 관계(프로필 최대 3장)
    @ManyToOne(() => UsersModel, (user) => user.images, { onDelete: 'CASCADE' })
    user?: UsersModel;
}