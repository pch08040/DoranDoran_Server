import { Injectable } from '@nestjs/common';
import { PaginatePostDto } from './dto/paginate-post.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { PostsModel } from './entity/posts.entity';
import { FindOptionsWhere, In, LessThan, MoreThan, Repository } from 'typeorm';
import { CreatePostDto } from './dto/create-post.dto';
import { CommonService } from 'src/common/common.service';
import { ImageModelType } from 'src/common/entity/image.entity';

@Injectable()
export class PostsService {
    constructor(
        @InjectRepository(PostsModel)
        private readonly postsRepository: Repository<PostsModel>,
        private readonly commonService: CommonService,
    ) { }

    async paginatePosts(dto: PaginatePostDto) {
        return this.commonService.paginate(
            dto,
            this.postsRepository,
            {},
            'posts',
        )
        // const where : FindOptionsWhere<PostsModel> = {}

        // if(dto.where__id__less_than){
        //     where.id = LessThan(dto.where__id__less_than);
        // }else if(dto.where__id__more_than){
        //     where.id = MoreThan(dto.where__id__more_than);
        // }

        // const posts = await this.postsRepository.find({
        //     where,
        //     order: {
        //         createdAt: dto.order__createdAt,
        //     },
        //     take: dto.take,
        //     // relations: ['images'],
        // });

        // // 해당되는 포스트가 0개 이상이면
        // // 마지막 포스트를 가져오고
        // // 아니면 null을 반환한다.
        // const lastItem = posts.length > 0 && posts.length === dto.take ? posts[posts.length - 1] : null;

        // // .env값 가져오기
        // const protocol = this.configService.get<string>(ENV_PROTOCOL_KEY);
        // const host = this.configService.get<string>(ENV_HOST_KEY);
        // const port = this.configService.get<string>(ENV_PORT_KEY);

        // // 마지막 데이터가 존재하면 URL객체 생성
        // const nextUrl = lastItem && new URL(`${protocol}://${host}:${port}/posts`);

        // if (nextUrl) {
        //     /**
        //      * dto의 키값들을 루핑하면서
        //      * 키값에 해당되는 벨류가 존재하면
        //      * param에 그대로 붙여넣는다.
        //      * 
        //      * 단, where__id_more_than 값만 lastItem의 마지막 값으로 넣어준다.
        //      */
        //     for (const key of Object.keys(dto)) {
        //         if (dto[key]) {
        //             if (key !== 'where__id__more_than' && key !== 'where__id__less_than') {
        //                 nextUrl.searchParams.append(key, dto[key]);
        //             }
        //         }
        //     }
        //     let key = '';

        //     if(dto.order__createdAt === 'ASC'){
        //         key = 'where__id__more_than';
        //     }else{
        //         key = 'where__id__less_than';
        //     }

        //     nextUrl.searchParams.append(key, lastItem.id.toString());
        // }

        // /**
        // * Response
        // * 
        // * data: Data[],
        // * cursor: {
        // *  after: 마지막 Data의 ID
        // * },
        // * count: 응답한 데이터의 갯수
        // * next: 다음 요청을 할때 사용할 URL
        // */

        // return {
        //     data: posts,
        //     cursor: {
        //         after: lastItem?.id ?? null
        //     },
        //     count: posts.length,
        //     next: nextUrl?.toString() ?? null,
        // }
    }

    // 랜덤 포스트 더미데이터 생성
    async generatePosts(userId: number) {
        for (let i = 0; i < 100; i++) {
            await this.createPost(userId, {
                content: `임의로 생성된 포스트 내용 ${i}`,
                images: [],
            });
        }
    }

    // 포스트 생성
    async createPost(authorId: number, postDto: CreatePostDto) {
        // const post = this.postsRepository.create({
        //     author: {
        //         id: authorId,
        //     },
        //     ...postDto,
        // });

        // const newPost = await this.postsRepository.save(post);

        // return newPost;

        // 1. DTO에서 이미지 파일명 배열과 나머지(content 등)를 분리합니다.
        const { images, ...postRest } = postDto;

        // 2. 포스트 본체만 먼저 생성합니다. 
        // 이제 images가 없으므로 타입 에러가 나지 않습니다.
        const post = this.postsRepository.create({
            author: {
                id: authorId,
            },
            ...postRest,
        });

        // 3. 포스트를 먼저 저장해서 postId를 확보합니다.
        const newPost = await this.postsRepository.save(post);

        // 4. 이미지가 있다면 CommonService를 이용해 처리합니다.
        if (images && images.length > 0) {
            for (let i = 0; i < images.length; i++) {
                await this.commonService.createImages({
                    fileName: images[i],
                    type: ImageModelType.POST_IMAGE, // 이번엔 포스트 이미지 타입!
                    order: i,
                    postId: newPost.id, // 방금 생성된 포스트 ID와 연결
                });
            }
        }

        // 5. 이미지가 포함된 완성된 포스트를 다시 조회해서 반환합니다.
        return newPost;
    }


    async deleteAllPosts() {
        await this.postsRepository
            .createQueryBuilder()
            .delete()
            .from(PostsModel)
            .execute();

        return true;
    }
}
