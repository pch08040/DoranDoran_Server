import { Body, Controller, Delete, Get, Post, Query, UseGuards } from '@nestjs/common';
import { PostsService } from './posts.service';
import { PaginatePostDto } from './dto/paginate-post.dto';
import { CreatePostDto } from './dto/create-post.dto';
import { UsersModel } from 'src/users/entities/users.entity';
import { User } from 'src/users/decorator/user.decorator';
import { DevOnlyGuard } from 'src/common/guard/dev-only.guard';

@Controller('posts')
export class PostsController {
  constructor(private readonly postsService: PostsService) { }

  @Get()
  getPosts(
    @Query() query: PaginatePostDto,
  ) {
    return this.postsService.paginatePosts(query);
  }

  /**
   * 와글와글 피드. 내 '만날 친구 설정'으로 걸러 최신순으로 준다.
   * (기획서 BE-Waggle-001 / FE-Waggle-005)
   *
   * ⚠️ 'feed' 는 @Get() 보다 아래에 있어도 된다.
   *    @Get() 은 경로가 비어 있어 /posts 만 받고, /posts/feed 와 겹치지 않는다.
   */
  @Get('feed')
  getFeed(
    @User() user: UsersModel,
    @Query() query: PaginatePostDto,
  ) {
    return this.postsService.paginateFeed(user.id, query);
  }

  /** 글 올리기. (기획서 FE-Waggle-015 / BE-Waggle-005) */
  @Post()
  postFeed(
    @User() user: UsersModel,
    @Body() dto: CreatePostDto,
  ) {
    return this.postsService.createPost(user.id, dto);
  }

  @Post('random')
  async postPostsRandom(@User() user: UsersModel) {
    await this.postsService.generatePosts(user.id);
    return true;
  }

  // ⚠️ 게시글 전체 삭제. 개발 중에만 쓰는 위험한 기능이다.
  // 예전에는 @IsPublic()이 붙어 있어서 토큰 없이 아무나 전체 삭제가 가능했다.
  // 이제는 로그인 필수 + 운영 환경에서는 DevOnlyGuard가 404로 막는다.
  @Delete('allDelete')
  @UseGuards(DevOnlyGuard)
  async deleteAllPosts() {
    return this.postsService.deleteAllPosts();
  }
}
