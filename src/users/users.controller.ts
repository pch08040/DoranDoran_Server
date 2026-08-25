import { Body, Controller, Get, Param, ParseIntPipe, Post, Put, Query, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersModel } from './entities/users.entity';
import { User } from './decorator/user.decorator';
import { PaginateUserDto } from './dto/paginate-user.dto';
import { UpdateSettingsDto } from './dto/update-settings.dto';
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

  /**
   * 내 '만날 친구 설정' 조회. (기획서 FE-Setting-001~003)
   * 아직 설정한 적이 없으면 기본값(전체 지역·전체 성별·19~99살)이 만들어져 나온다.
   */
  @Get('me/settings')
  getMySettings(@User() user: UsersModel) {
    return this.usersService.getSettings(user.id);
  }

  /** 만날 친구 설정 저장. (기획서 FE-Setting-004) */
  @Put('me/settings')
  putMySettings(
    @User() user: UsersModel,
    @Body() dto: UpdateSettingsDto,
  ) {
    return this.usersService.updateSettings(user.id, dto);
  }

  /**
   * 홈 화면의 친구 목록. 내 설정으로 걸러 최신 접속순으로 준다.
   * (기획서 BE-Setting-001 / BE-Setting-003)
   */
  @Get('recommendations')
  async getRecommendations(
    @User() user: UsersModel,
    @Query() query: PaginateUserDto,
  ) {
    // 목록을 부르는 것 = 앱을 쓰고 있다는 뜻이므로 접속 시각을 갱신한다.
    // 조회 결과를 기다리게 하지 않으려고 먼저 던져두고 진행한다.
    await this.usersService.touchLastActive(user.id);

    return this.usersService.getRecommendations(user.id, query);
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

  /**
   * 상대방 프로필. (기획서 FE-Profile-001)
   *
   * ⚠️ 이 경로는 **반드시 맨 아래**에 있어야 한다.
   *    ':id' 는 아무 글자나 받아들이므로, 위에 두면
   *    GET /users/me 나 GET /users/recommendations 까지 여기로 빨려 들어온다.
   *
   *    ⚠️ **다른 파일의 주소는 순서로 못 막는다.**
   *    ModerationController 의 /users/report-reasons 가 실제로 여기에 빨려 들어가
   *    400 이 났다. 모듈 등록 순서(app.module.ts)에서 UsersModule 이 먼저라서다.
   *    그래서 app.module.ts 에서 ModerationModule 을 UsersModule 보다 **앞에** 둔다.
   *
   *    `:id(\\d+)` 같은 정규식 문법은 쓸 수 없다.
   *    NestJS 11 이 쓰는 path-to-regexp v8 에서 없어졌고, 서버가 아예 못 뜬다.
   */
  @Get(':id')
  getUserDetail(
    @User() user: UsersModel,
    @Param('id', ParseIntPipe) id: number,
  ) {
    // 보는 사람이 누구인지 넘겨야 차단 관계를 확인할 수 있다.
    return this.usersService.getUserDetail(user.id, id);
  }


}
