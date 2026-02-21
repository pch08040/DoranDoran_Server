import { Entity, ManyToOne } from "typeorm";
import { BaseModel } from "./base.entity";
import { PostsModel } from "src/posts/entity/posts.entity";

@Entity()
export class ImageModel extends BaseModel{
    @ManyToOne((type) => PostsModel, (post) => post.images)
    post?: PostsModel;
}