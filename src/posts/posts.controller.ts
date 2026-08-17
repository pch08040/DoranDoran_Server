import { Body, Controller, Delete, Get, Post, Query, UseGuards } from '@nestjs/common';
import { PostsService } from './posts.service';
import { PaginatePostDto } from './dto/paginate-post.dto';
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
