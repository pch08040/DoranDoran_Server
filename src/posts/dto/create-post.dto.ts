import { IsArray, IsOptional, IsString } from "class-validator";
import { PostsModel } from "../entity/posts.entity";
import { PickType } from "@nestjs/mapped-types";

// Pick, Omit, Partial -> Type 반환
// PickType, OmitType, ParitalType -> 값을 반환

export class CreatePostDto extends PickType(PostsModel, ['content']) {
    @IsArray() // 배열 형태로 들어오는지 확인
    @IsString({
        each: true, // 배열 안의 각 항목이 문자열인지 확인
    })
    @IsOptional()
    images: string[] = [];
}