import { Inject, Injectable, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { UsersModel } from 'src/users/entities/users.entity';
import { ConfigService } from "@nestjs/config";
import { ENV_JWT_SECRET_KEY, ENV_NODE_ENV_KEY, PRODUCTION } from 'src/common/const/env-keys.const';
import { CACHE_MANAGER } from '@nestjs/cache-manager';
import type { Cache } from 'cache-manager';
import { UsersService } from 'src/users/users.service';
import { UpdateProfileDto } from 'src/users/dto/update-profile.dto';
import { ImageModelType } from 'src/common/entity/image.entity';
import { CommonService } from 'src/common/common.service';
import { DomainException } from 'src/common/exception/domain.exception';
import { withTimeout } from 'src/common/util/with-timeout.util';

/**
 * 토큰 유효기간.
 * 값의 형식은 '30m'(30분), '30d'(30일) 처럼 쓴다.
 */
export const ACCESS_TOKEN_EXPIRES_IN = {
    access: '30m',
    refresh: '30d',
} as const;

@Injectable()
export class AuthService {
    private readonly logger = new Logger(AuthService.name);

    constructor(
        @Inject(CACHE_MANAGER) private cacheManager: Cache,
        private readonly usersService: UsersService,
        private readonly jwtService: JwtService,
        private readonly configService: ConfigService,
        private readonly commonService: CommonService,
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
            throw new DomainException('AUTH_TOKEN_INVALID');
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
            throw new DomainException('AUTH_TOKEN_INVALID');
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
            throw new DomainException('AUTH_TOKEN_INVALID');
        }
    }

    rotateToken(token: string, isRefreshToken: boolean) {
        /**
         * signToken()이 넣어둔 payload 구조
         *
         * sub: 유저 id
         * phoneNumber: 전화번호
         * type: 'access' | 'refresh'
         *
         * 주의) verify에 complete: true를 주면 payload가 아니라
         * { header, payload, signature } 가 반환된다.
         * 그러면 payload.type을 못 읽어서 항상 예외가 터지므로 쓰지 않는다.
         */
        const payload = this.verifyToken(token);

        if (payload.type !== "refresh") {
            throw new DomainException('AUTH_TOKEN_TYPE_MISMATCH');
        }

        // payload를 그대로 스프레드하면 id가 없다(sub에 들어있음).
        // signToken이 기대하는 형태로 다시 매핑해준다.
        return this.signToken({
            id: payload.sub,
            phoneNumber: payload.phoneNumber,
        }, isRefreshToken);
    }


    // 1) sendRegisterCode
    // - 6자리 랜덤 숫자(인증번호)를 만들고 Redis에 "키(전화번호):값(인증번호)"형태로 저장
    //
    // ⚠️ 인증번호는 절대 응답(HTTP response)에 담지 않는다.
    //    응답에 담으면 아무나 남의 전화번호로 요청해서 인증번호를 받아낼 수 있고,
    //    그대로 가입까지 되어버린다.
    //    개발 중에는 서버 터미널 로그로만 확인한다.
    //
    // TODO(Phase 2): 실제 SMS 발송 연동 (NCP SENS / 알리고 / Twilio 등)
    async sendRegisterCode(phoneNumber: string) {
        const code = Math.floor(100000 + Math.random() * 900000).toString();

        // Redis에 저장 (key: 전화번호, value: 인증번호, ttl: 유효시간 180초)
        // set(key, value, ttl) 함수는 데이터를 저장할 때 씁니다.
        //
        // withTimeout 으로 감싸는 이유
        //   Redis가 죽어 있으면 이 줄은 에러를 내지 않고 영원히 기다린다.
        //   그러면 앱에서 로딩 스피너가 안 멈춘다. 2초 안에 끊고 에러로 알린다.
        await withTimeout(
            this.cacheManager.set(`AUTH_CODE:${phoneNumber}`, code, 180000),
        );

        // 운영 환경이 아닐 때만 터미널에 인증번호를 찍어준다.
        if (this.configService.get<string>(ENV_NODE_ENV_KEY) !== PRODUCTION) {
            this.logger.log(`[개발용] ${phoneNumber} 인증번호: ${code}`);
        }

        return {
            message: '인증번호가 발송되었습니다. 3분 안에 입력해주세요.',
        }
    }

    // 2) verificationCode // loginWithPhoneNumber
    // - Redis에서 키를 꺼내서 입력된 인증번호와 비교 후 값이 없거나 다르면 에러메세지 발송
    //   값이 있다면 Redis에서 유저 키 삭제 후 임시유저 저장 loginUser로 유저정보 전달
    //   유저 정보의 isProfileCompleted: false 형태로 저장
    async verificationCode(phoneNumber: string, inputCode: string) {
        // Redis에서 인증번호를 가져옴
        const redisKey = `AUTH_CODE:${phoneNumber}`;
        const savedCode = await withTimeout(this.cacheManager.get<string>(redisKey));

        if (!savedCode) {
            throw new DomainException('AUTH_CODE_EXPIRED');
        }

        if (savedCode !== inputCode) {
            throw new DomainException('AUTH_CODE_MISMATCH');
        }

        // 인증 성공 시 Redis 코드 삭제
        await withTimeout(this.cacheManager.del(redisKey));

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
        // 응답 키는 다른 API와 똑같이 캐멀케이스로 통일한다.
        //
        // 예전에는 ACCESS_TOKEN / REFRESH_TOKEN (대문자 스네이크)을 썼는데,
        // 재발급 API(/auth/token/access)는 accessToken 을 돌려주고 있었다.
        // 같은 값인데 엔드포인트마다 이름이 달라서, 앱이 두 형식을 따로 파싱해야 했다.
        // 한쪽만 고치면 조용히 깨지는 구조라 위험했다.
        return {
            user: user,
            accessToken: this.signToken(user, false),
            refreshToken: this.signToken(user, true),
        }
    }

    // 4) signToken
    // - (3)에 필요한 accessToken과 refreshToken을 발급하는 로직
    //   payload(토큰 안에 담기는 정보)에 phoneNumber, id를 담아 발급한다.
    //
    // 만료 시간을 두 토큰이 다르게 가져가는 이유
    //  - accessToken : 매 요청마다 실려 다녀서 새어나갈 위험이 크므로 짧게(30분)
    //  - refreshToken: 재발급 용도로만 쓰이므로 길게(30일).
    //                  덕분에 사용자는 30일간 다시 로그인하지 않아도 된다.
    //   (예전에는 둘 다 3600초라 재발급 구조 자체가 의미가 없었다)
    signToken(user: Pick<UsersModel, "phoneNumber" | "id">, isRefreshToken: boolean) {
        const payload = {
            phoneNumber: user.phoneNumber,
            sub: user.id,
            type: isRefreshToken ? "refresh" : "access"
        }

        return this.jwtService.sign(payload, {
            secret: this.configService.get<string>(ENV_JWT_SECRET_KEY),
            expiresIn: isRefreshToken ? ACCESS_TOKEN_EXPIRES_IN.refresh : ACCESS_TOKEN_EXPIRES_IN.access,
        });
    }

    // 5) completeProfile  (POST /auth/profile)
    // - 초기 프로필 설정 화면의 API
    //   프론트에선 방금 토큰을 발급받은 사용자의 전화번호와 isProfileCompleted 값을 전달받고
    //   isProfileCompleted: false일때 화면을 띄움
    //   서버에선 가입완료에 필요한 필수 유저 정보를 받은 뒤 프로필을 DB에 저장하고
    //   isProfileCompleted: true로 바꾼뒤 앱의 초기 "친구찾기" 화면으로 보냄(뒤로가기를 눌러도 기존 화면들은 스택에서 지워둠)
    async completeProfile(userId: number, userData: UpdateProfileDto) {
        // console.log('들어온 데이터:', userData);
        const { profileImages, ...userRest } = userData;
        await this.usersService.updateProfile(userId, userRest);

        if(profileImages && profileImages.length > 0){
            await this.commonService.delteUserImages(userId);

            // 새 이미지들을 옮김
            for(let i = 0; i<profileImages.length; i++){
                await this.commonService.createImages({
                    fileName: profileImages[i],
                    type: ImageModelType.USER_IMAGE,
                    order: i,
                    userId: userId,
                });
            }
        }

        // await this.usersService.updateProfile(userId, {isProfileCompleted: true});

        return await this.usersService.getUserById(userId);
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