import { Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersModel } from './entities/users.entity';
import { User } from './decorator/user.decorator';
import { PaginateUserDto } from './dto/paginate-user.dto';
import { DevOnlyGuard } from 'src/common/guard/dev-only.guard';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) { }

  // @Get()
  // @IsPublic()
  // getUsers() {
  //   return this.usersService.getAllUsers();
  // }

  @Get('me')
  getMe(@User() user: UsersModel) {
    // 가드(토큰 검사기)가 넣어주는 user에는 프로필 사진(images)이 들어있지 않다.
    // 가드는 매 요청마다 실행되므로 가볍게 유지하고,
    // 사진까지 필요한 이 API에서만 관계(relations)를 포함해 다시 조회한다.
    //
    // 이걸 빼먹으면 사진을 3장 등록해도 응답에는 늘 기본 프로필만 나온다.
    // (UsersModel의 @Transform이 '사진 없음'으로 판단해서 기본값을 대신 내려줌)
    return this.usersService.getUserById(user.id);
  }

  // 유저 목록은 개인정보이므로 로그인한 사용자만 볼 수 있다.
  // (예전에는 @IsPublic()이 붙어 있어서 토큰 없이 전체 유저 조회가 가능했다)
  @Get()
  getPaginateUser(
    @Query() query: PaginateUserDto,
  ) {
    return this.usersService.paginateUsers(query);
  }

  // 개발용 더미 유저 생성. 운영 환경에서는 DevOnlyGuard가 404로 막는다.
  @Post('randomuser')
  @UseGuards(DevOnlyGuard)
  postCreateRandomUser() {
    return this.usersService.createDummyUsers();
  }


}
