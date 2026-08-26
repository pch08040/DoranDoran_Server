import { IsString } from "class-validator";
import { BaseModel } from "src/common/entity/base.entity";
import { ImageModel } from "src/common/entity/image.entity";
import { stringValidationMessage } from "src/common/validation-message/string-validation.message";
import { UsersModel } from "src/users/entities/users.entity";
import { Column, Entity, Index, ManyToOne, OneToMany, } from "typeorm";

@Entity()
/**
 * 피드는 항상 '만료되지 않은 글을 최신순으로' 읽는다.
 * 두 조건이 한 인덱스에 같이 있어야 거르기와 줄 세우기를 한 번에 끝낸다.
 *
 * 글은 2일 뒤 지워지지만, 그전까지는 계속 쌓인다.
 * 사용자가 늘면 하루 수천 건이 되므로 인덱스 없이는 매번 전부 훑게 된다.
 */
@Index(['createdAt'])
export class PostsModel extends BaseModel {
    @ManyToOne(() => UsersModel, (user) => user.posts, {
        nullable: false,
    })
    author: UsersModel;

    @Column()
    @IsString({
        message: stringValidationMessage,
    })
    content: string;
    
    // 게시물 사진
    @OneToMany(() => ImageModel, (image) => image.post)
    images: ImageModel[];
}