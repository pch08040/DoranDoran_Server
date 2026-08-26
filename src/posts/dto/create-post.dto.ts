import { IsArray, IsOptional, IsString, MaxLength } from "class-validator";
import { POST_MAX_LENGTH } from "../const/post.const";

/**
 * 와글와글 글 작성. (시안: 게시글 올리기 / 기획서 FE-Waggle-013~015)
 *
 * 사진은 파일이 아니라 '미리 올려둔 임시 이미지의 이름'을 받는다.
 * 프로필 사진과 같은 방식이다. (POST /common/image 가 돌려준 fileName)
 */
export class CreatePostDto {
    @IsString({ message: '내용을 확인해주세요.' })
    @MaxLength(POST_MAX_LENGTH, {
        message: `글은 최대 ${POST_MAX_LENGTH}자까지 쓸 수 있어요.`,
    })
    content: string;

    // 사진은 최대 1장이지만, 이미지 처리 코드를 프로필과 공유하려고 배열로 받는다.
    @IsArray({ message: '사진 정보가 올바르지 않습니다.' })
    @IsString({ each: true, message: '사진 정보가 올바르지 않습니다.' })
    @IsOptional()
    images: string[] = [];
}
