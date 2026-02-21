import { Body, Controller, Delete, Get, Post, Query, UseGuards } from '@nestjs/common';
import { PostsService } from './posts.service';
import { PaginatePostDto } from './dto/paginate-post.dto';
import { UsersModel } from 'src/users/entities/users.entity';
import { User } from 'src/users/decorator/user.decorator';
import { AccessTokenGuard } from 'src/auth/guard/bearer-token.guard';
import { IsPublic } from 'src/common/decorator/is-public.decorator';

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

  @Delete('allDelete')
  @IsPublic() // 테스트 편의를 위해 일단 Public으로 열어둡니다.
  async deleteAllPosts() {
    return this.postsService.deleteAllPosts();
  }
}
