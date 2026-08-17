import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { IsPublic } from 'src/common/decorator/is-public.decorator';
import { RefreshTokenGuard } from './guard/bearer-token.guard';
import { UpdateProfileDto } from 'src/users/dto/update-profile.dto';
import { UsersModel } from 'src/users/entities/users.entity';
import { User } from 'src/users/decorator/user.decorator';
import { RegisterUserDto } from './dto/register-user.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) { }

  @Post('token/access')
  @IsPublic()
  @UseGuards(RefreshTokenGuard)
  postTokenAccess(@Req() req: any) {

    const newToken = this.authService.rotateToken(req.token, false);

    return {
      accessToken: newToken,
    }
  }

  @Post('token/refresh')
  @IsPublic()
  @UseGuards(RefreshTokenGuard)
  postTokenRefresh(@Req() req: any) {

    const newToken = this.authService.rotateToken(req.token, true);

    return {
      refreshToken: newToken,
    }
  }

  /**
   * 인증번호 발송 ('인증번호 받기' 버튼)
   *
   * 경로 이름 규칙
   *   예전 이름은 postSendRegisterCode 였는데 문제가 두 가지였다.
   *   1) POST 로 부르는데 이름에도 post 가 들어가 중복이다
   *   2) postVerificationCode 와 이름이 비슷해서 어느 쪽이 발송이고
   *      어느 쪽이 검증인지 이름만 보고 알 수 없었다
   *   그래서 '무엇을 다루는가(명사)'로 바꾸고, 동작은 HTTP 메서드와 하위 경로로 나타낸다.
   */
  @Post('verification-code')
  @IsPublic()
  sendVerificationCode(@Body() dto: RegisterUserDto) {
    return this.authService.sendRegisterCode(dto.phoneNumber);
  }

  /** 인증번호 검증 → 임시 유저 생성 → 토큰 발급 */
  @Post('verification-code/verify')
  @IsPublic()
  verifyVerificationCode(
    @Body('phoneNumber') phoneNumber: string,
    @Body('inputCode') inputCode: string,
  ) {
    return this.authService.verificationCode(phoneNumber, inputCode);
  }

  /**
   * 프로필을 채워 가입을 확정한다.
   *
   * 전역 AccessTokenGuard 가 이미 토큰을 검사하므로 따로 가드를 붙이지 않는다.
   * (@IsPublic() 이 없으면 기본이 '로그인 필요')
   */
  @Post('profile')
  completeProfile(
    @User() user: UsersModel,
    @Body() userData: UpdateProfileDto,
  ) {
    return this.authService.completeProfile(user.id, userData);
  }
}
