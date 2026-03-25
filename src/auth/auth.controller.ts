import { Body, Controller, Headers, Patch, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { BasicTokenGuard } from './guard/basic-token.guard';
import { IsPublic } from 'src/common/decorator/is-public.decorator';
import { AccessTokenGuard, RefreshTokenGuard } from './guard/bearer-token.guard';
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

  // 인증번호 발송 요청(인증번호 받기 버튼)
  @Post('postSendRegisterCode')
  @IsPublic()
  postSendRegisterCode(@Body() dto: RegisterUserDto) {
    return this.authService.sendRegisterCode(dto.phoneNumber);
  }

  // 인증번호 인증 & 토큰발급 & 임시유저 저장
  @Post('postVerificationCode')
  @IsPublic()
  postVerificationCode(
    @Body('phoneNumber') phoneNumber: string,
    @Body('inputCode') inputCode: string,
  ) {
    return this.authService.verificationCode(phoneNumber, inputCode);
  }

  // 임시유저 프로필 설정까지 완료
  @Post('completedSaveProfile')
  // 토큰이 발급된 임시 유저만 프로필 설정을 완료할 수 있음
  // @UseGuards(AccessTokenGuard)
  completedSaveProfile(
    @User() user: UsersModel,
    @Body() userData: UpdateProfileDto) {
    return this.authService.completedSaveProfile(user.id, userData);
  }
}
