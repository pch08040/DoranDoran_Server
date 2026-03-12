import { Column, Entity, ManyToOne } from "typeorm";
import { BaseModel } from "./base.entity";
import { IsEnum, IsInt, IsOptional, IsString } from "class-validator";
import { Transform } from "class-transformer";
import { PostsModel } from "src/posts/entity/posts.entity";
import { UsersModel } from "src/users/entities/users.entity";

export enum ImageModelType {
    POST_IMAGE,
    USER_IMAGE,
}

@Entity()
export class ImageModel extends BaseModel {
    @Column()
    @IsString()
    @Transform(({ value, obj }) => {
        if (obj.type === ImageModelType.POST_IMAGE) {
            return `/public/posts/${value}`;
        } else if (obj.type === ImageModelType.USER_IMAGE) {
            return `/public/users/${value}`;
        }
        return value;
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