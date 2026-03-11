import { BadRequestException, Inject, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersModel } from 'src/users/entities/users.entity';
import { ConfigService } from "@nestjs/config";
import { ACCESS_TOKEN, ENV_JWT_SECRET_KEY, REFRESH_TOKEN } from 'src/common/const/env-keys.const';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { UsersService } from 'src/users/users.service';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';

@Injectable()
export class AuthService {
    constructor(
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
        private readonly usersService: UsersService,
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
    ) {

    }

    /**
 * 토큰을 사용하게 되는 방식
 *
 * 1) 사용자가 로그인 또는 회원가입을 진행하면
 *    accessToken과 refreshToken을 발급받는다.
 * 2) 로그인 할때는 Basic 토큰과 함께 요청을 보낸다.
 *    Basic 토큰은 '이메일:비밀번호'를 Base64로 인코딩한 형태이다.
 *    예) {authorization: 'Basic {token}'}
 * 3) 아무나 접근 할 수 없는 정보 (private route)를 접근 할때는
 *    accessToken을 Header에 추가해서 요청과 함께 보낸다.
 *    예) {authorization: 'Bearer {token}'}
 * 4) 토큰과 요청을 함께 받은 서버는 토큰 검증을 통해 현재 요청을 보낸
 *    사용자가 누구인지 알 수 있다.
 *    예를들어서 현재 로그인한 사용자가 작성한 포스트만 가져오려면
 *    토큰의 sub 값에 입력돼있는 사용자의 포스트만 따로 필터링 할 수 있다.
 *    특정 사용자의 토큰이 없다면 다른 사용자의 데이터를 접근 못한다.
 * 5) 모든 토큰은 만료 기간이 있다. 만료기간이 지나면 새로 토큰을 발급받아야한다.
 *    그렇지 않으면 jwtService.verify()에서 인증이 통과 안된다.
 *    그러니 access 토큰을 새로 발급 받을 수 있는 /auth/token/access와
 *    refresh 토큰을 새로 발급 받을 수 있는 /auth/token/refresh가 필요하다.
 * 6) 토큰이 만료되면 각각의 토큰을 새로 발급 받을 수 있는 엔드포인트에 요청을 해서
 *    새로운 토큰을 발급받고 새로운 토큰을 사용해서 private route에 접근한다.
 */

    // 토큰을 받아 구분한 뒤 token을 리턴
    extractTokenFromHeader(header: string, isBearer: boolean) {
        // 'Basic {token}'
        // [Basic, {token}]
        // 'Bearer {token}'
        // [Bearer, {token}]
        const splitToken = header.split(" ");

        const prefix = isBearer ? "Bearer" : "Basic";

        if (splitToken.length !== 2 || splitToken[0] !== prefix) {
            throw new UnauthorizedException("잘못된 토큰입니다!");
        }

        const token = splitToken[1];

        return token;
    }

    /**
   * Basic al;sdkfjoiasdjlzkxcjvsdf
   *
   * 1) al;sdkfjoiasdjlzkxcjvsdf -> email:password
   * 2) email:password -> [email, password]
   * 3) {email: email, password: password}
   */
    // 반환된 코드를 decode해서 전화번호와 인증코드를 알아냄
    decodeBasicToken(base64String: string) {
        const decoded = Buffer.from(base64String, "base64").toString("utf8");

        const split = decoded.split(":");

        if (split.length !== 2) {
            throw new UnauthorizedException("잘못된 유형의 토큰입니다.")
        }

        const phoneNumber = split[0];
        const code = split[1];

        return {
            phoneNumber,
            code,
        };
    }

    // 토큰 검증
    verifyToken(token: string) {
        try {
            return this.jwtService.verify(token, {
                secret: this.configService.get<string>(ENV_JWT_SECRET_KEY)
            });
        } catch (e) {
            throw new UnauthorizedException("토큰이 만료됐거나 잘못된 토큰입니다.")
        }
    }

    rotateToken(token: string, isRefreshToken: boolean) {
        const decoded = this.jwtService.verify(token, {
            secret: this.configService.get<string>(ENV_JWT_SECRET_KEY),
            complete: true,
        });

        /**
        * sub: id
        * email: email,
        * type: 'access' | 'refresh'
        */
        if (decoded.type !== "refresh") {
            throw new UnauthorizedException("토큰 재발급은 Refresh 토큰으로만 가능합니다!");
        }

        return this.signToken({
            ...decoded
        }, isRefreshToken);
    }


    // 1) sendRegisterCode
    // - 6자리 랜덤 숫자(인증번호)를 만들고 Redis에 "키(전화번호):값(인증번호)"형태로 저장
    //   저장완료 메세지 발송 `${phoneNumber}번호로 인증번호(${code})가 발송되었습니다`
    async sendRegisterCode(phoneNumber: string) {
        const code = Math.floor(100000 + Math.random() * 900000).toString();

        // Redis에 저장 (key: 전화번호, value: 인증번호, ttl: 유효시간 180초)
        // set(key, value, ttl) 함수는 데이터를 저장할 때 씁니다.
        await this.cacheManager.set(`AUTH_CODE:${phoneNumber}`, code, 180000);

        return {
            message: `${phoneNumber}번호로 인증번호(${code})가 발송되었습니다`
        }
    }

    // 2) verificationCode // loginWithPhoneNumber
    // - Redis에서 키를 꺼내서 입력된 인증번호와 비교 후 값이 없거나 다르면 에러메세지 발송
    //   값이 있다면 Redis에서 유저 키 삭제 후 임시유저 저장 loginUser로 유저정보 전달
    //   유저 정보의 isProfileCompleted: false 형태로 저장
    async verificationCode(phoneNumber: string, inputCode: string) {
        // Redis에서 인증번호를 가져옴
        const redisKey = `AUTH_CODE:${phoneNumber}`;
        const savedCode = await this.cacheManager.get<string>(`AUTH_CODE:${phoneNumber}`);

        if (!savedCode) {
            throw new BadRequestException("인증번호가 만료되었거나 요청한 적이 없습니다.");
        }

        if (savedCode !== inputCode) {
            throw new UnauthorizedException('인증번호가 일치하지 않습니다.')
        }

        // 인증 성공 시 Redis 코드 삭제
        await this.cacheManager.del(redisKey);

        let user = await this.usersService.getUserByPhoneNumber(phoneNumber);

        if (!user) {
            user = await this.usersService.createUser({
                phoneNumber,
                isProfileCompleted: false, // 프로필 확정 전 단계이므로
            });
        }

        // 토큰발급을 위해 임시유저 값을 넘김
        return this.loginUser(user);
    }


    // 3) loginUser
    // - signToken에 필요한 값을 넘겨서 accessToken과 refreshToken을 반환하는 로직
    loginUser(user: UsersModel) {
        return {
            user: user,
            [ACCESS_TOKEN]: this.signToken(user, false),
            [REFRESH_TOKEN]: this.signToken(user, true),
            // 임시유저인지 확인, 화면 분기 생성용 코드
            // isProfileCompleted: user.isProfileCompleted,
        }
    }

    // 4) signToken
    // - (3)에 필요한 accessToken과 refreshToken을 발급하는 로직
    //   payload에 phoneNumber, id를 담아 secretKey와 함께 토큰을 발급
    signToken(user: Pick<UsersModel, "phoneNumber" | "id">, isRefreshToken: boolean) {
        const payload = {
            phoneNumber: user.phoneNumber,
            sub: user.id,
            type: isRefreshToken ? "refresh" : "access"
        }

        return this.jwtService.sign(payload, {
            secret: this.configService.get<string>(ENV_JWT_SECRET_KEY),
            expiresIn: isRefreshToken ? 3600 : 3600
        });
    }

    // 5) completedSaveProfile
    // - 초기 프로필 설정 화면의 API
    //   프론트에선 방금 토큰을 발급받은 사용자의 전화번호와 isProfileCompleted 값을 전달받고
    //   isProfileCompleted: false일때 화면을 띄움
    //   서버에선 가입완료에 필요한 필수 유저 정보를 받은 뒤 프로필을 DB에 저장하고
    //   isProfileCompleted: true로 바꾼뒤 앱의 초기 "친구찾기" 화면으로 보냄(뒤로가기를 눌러도 기존 화면들은 스택에서 지워둠)
    async completedSaveProfile(userId: number, userData: Partial<UsersModel>) {
        const newUser = await this.usersService.updateProfile(userId, userData);

        return newUser
    }
}

/**
 * 1) registerWithPhoneNumber
 *    - 6자리 랜덤 숫자(인증번호)를 만들고 Redis에 "키(전화번호):값(인증번호)"형태로 저장
 *      저장완료 메세지 발송 `${phoneNumber}번호로 인증번호(${code})가 발송되었습니다`
 * 
 * 2) verificationCode
 *    - Redis에서 키를 꺼내서 입력된 인증번호와 비교 후 값이 없거나 다르면 에러메세지 발송
 *      값이 있다면 Redis에서 유저 키 삭제 후 임시유저 저장 loginUser로 유저정보 전달
 *      유저 정보의 isProfileCompleted: false 형태로 저장
 * 
 * 3) loginUser
 *    - signToken에 필요한 값을 넘겨서 accessToken과 refreshToken을 반환하는 로직
 * 
 * 4) signToken
 *    - (3)에 필요한 accessToken과 refreshToken을 발급하는 로직
 *      payload에 phoneNumber, id를 담아 secretKey와 함께 토큰을 발급
 * 
 * 5) completedSignProfile
 *    초기 프로필 설정 화면의 API
 *    프론트에선 방금 토큰을 발급받은 사용자의 전화번호와 isProfileCompleted 값을 전달받고
 *    isProfileCompleted: false일때 화면을 띄움
 *    서버에선 가입완료에 필요한 Pick<UsersModel, "phoneNumber"|"isProfileCompleted"|"firstName"|"lastName"|"gender"|"age"|"area"|"bio">
 *    나머지 값들을 받은 뒤 프로필을 DB에 저장하고 isProfileCompleted: true로 바꾼뒤 앱의 초기 "친구찾기" 화면으로 보냄(뒤로가기를 눌러도 기존 화면들은 스택에서 지워둠)
 * 
 * 6) 프론트는 Flutter로 구현 예정이고
 *    이후 초기 프로필 설정 화면은 isProfileCompleted: false인 유저가 진입 불가능함
 *    ProfileGuard를 사용한 제어도 구현
*/