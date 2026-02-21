import { IsString } from "class-validator";
import { BaseModel } from "src/common/entity/base.entity";
import { ImageModel } from "src/common/entity/image.entity";
import { stringValidationMessage } from "src/common/validation-message/string-validation.message";
import { UsersModel } from "src/users/entities/users.entity";
import { Column, Entity, ManyToOne, OneToMany } from "typeorm";

@Entity()
export class PostsModel extends BaseModel{
    @ManyToOne(() => UsersModel, (user) => user.posts,{
        nullable: false,
    })
    author: UsersModel;

    @Column()
    @IsString({
        message: stringValidationMessage,
    })
    content: string;

    @OneToMany((type) => ImageModel, (image) => image.post)
    images: ImageModel[];
}