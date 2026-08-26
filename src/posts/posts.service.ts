import { Injectable, Logger } from '@nestjs/common';
import { PaginatePostDto } from './dto/paginate-post.dto';
import { InjectRepository } from '@nestjs/typeorm';
import { PostsModel } from './entity/posts.entity';
import { Between, FindOptionsWhere, In, MoreThan, Not, Repository } from 'typeorm';
import { CreatePostDto } from './dto/create-post.dto';
import { CommonService } from 'src/common/common.service';
import { ImageModelType } from 'src/common/entity/image.entity';
import { Cron, CronExpression } from '@nestjs/schedule';
import { UsersService } from 'src/users/users.service';
import { ModerationService } from 'src/moderation/moderation.service';
import { UsersModel } from 'src/users/entities/users.entity';
import { POST_LIFETIME_MS } from './const/post.const';

@Injectable()
export class PostsService {
    constructor(
        @InjectRepository(PostsModel)
        private readonly postsRepository: Repository<PostsModel>,
        private readonly commonService: CommonService,
        private readonly usersService: UsersService,
        private readonly moderationService: ModerationService,
    ) { }

    private readonly logger = new Logger(PostsService.name);

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
    /**
     * 와글와글 피드. (기획서 BE-Waggle-001 / FE-Waggle-005)
     *
     * 홈의 친구 목록과 **같은 조건**(만날 친구 설정)을 쓴다.
     * 홈에서 볼 수 없는 사람의 글이 피드에는 뜨면 앞뒤가 안 맞는다.
     *
     * 빼는 것
     *   · 만날 친구 설정(지역·성별·나이)에 안 맞는 사람
     *   · 차단 관계인 사람 (기획서 BE-Waggle-003 / FE-Waggle-010)
     *   · 2일이 지난 글 (아래 자동 삭제가 돌기 전이라도 안 보이게)
     */
    async paginateFeed(userId: number, dto: PaginatePostDto) {
        const settings = await this.usersService.getSettings(userId);
        const hiddenIds = await this.moderationService.getHiddenUserIds(userId);

        const author: FindOptionsWhere<UsersModel> = {
            isProfileCompleted: true,
            age: Between(settings.minAge, settings.maxAge),
        };

        // null 은 '전체'라는 뜻이므로 조건을 걸지 않는다.
        if (settings.area) author.area = settings.area;
        if (settings.gender) author.gender = settings.gender;

        // 차단 관계인 사람은 뺀다. 내 글은 피드에 보인다(내가 쓴 걸 확인해야 한다).
        if (hiddenIds.length > 0) author.id = Not(In(hiddenIds));

        return this.commonService.paginate(
            dto,
            this.postsRepository,
            {
                where: {
                    author,
                    // 만료 시각이 지난 글은 청소가 돌기 전이라도 숨긴다.
                    createdAt: MoreThan(this.feedCutoff()),
                },
                relations: ['author', 'author.images', 'images'],
                order: { createdAt: 'DESC' },
            },
            'posts/feed',
        );
    }

    /** 이 시각보다 오래된 글은 안 보여준다 */
    private feedCutoff() {
        return new Date(Date.now() - POST_LIFETIME_MS);
    }

    /**
     * 2일이 지난 글을 지운다. (기획서: 게시물 2일 뒤 자동삭제)
     *
     * 매시 정각에 돈다. 하루 한 번만 돌면 최대 24시간까지 남아 있게 된다.
     *
     * ⚠️ 시각 비교라 시간대가 맞아야 한다.
     *   예전에 시각 컬럼이 timestamp(시간대 없음)였을 때는
     *   서버(한국)와 DB(세계 표준시)가 9시간 어긋나 있었다.
     *   그대로 뒀으면 글이 9시간 일찍 또는 늦게 지워졌다.
     *   지금은 timestamptz 라 안전하다.
     */
    @Cron(CronExpression.EVERY_HOUR)
    async removeExpiredPosts() {
        const cutoff = this.feedCutoff();

        const result = await this.postsRepository
            .createQueryBuilder()
            .delete()
            .where('"createdAt" < :cutoff', { cutoff })
            .execute();

        if (result.affected) {
            this.logger.log(`오래된 게시글 ${result.affected}건 삭제 (기준: ${cutoff.toISOString()})`);
        }
    }

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
