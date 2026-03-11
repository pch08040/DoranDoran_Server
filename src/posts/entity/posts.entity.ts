import { IsString } from "class-validator";
import { BaseModel } from "src/common/entity/base.entity";
import { stringValidationMessage } from "src/common/validation-message/string-validation.message";
import { UsersModel } from "src/users/entities/users.entity";
import { Column, Entity, ManyToOne, } from "typeorm";

@Entity()
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

    @Column({
        nullable: true
    })
    @IsString({
        message: stringValidationMessage,
    })
    postImagePath: string;
}