import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { AuthService } from "../auth.service";
import { UsersService } from "src/users/users.service";
import { Reflector } from "@nestjs/core";
import { IS_PUBLIC_KEY } from "src/common/decorator/is-public.decorator";

@Injectable()
export class BearerTokenGuard implements CanActivate {
    constructor(
        private readonly authService: AuthService,
        private readonly usersService: UsersService,
        private readonly reflector: Reflector
    ){}

    async canActivate(context: ExecutionContext): Promise<boolean>{

        // 현재 요청이 로그인이 필요 없는(Public) 경로인지 확인
        // reflector.getAllAndOverride: 우선순위에 따라 값을 가져오되, 값이 발견되면 그 값을 쓰고 없으면 다음 순위로 넘어가라
        const isPublic = this.reflector.getAllAndOverride(
            IS_PUBLIC_KEY,
            [
                // 1순위: 현재 실행 중인 '함수'에 스티커가 붙어있는가?
                context.getHandler(),
                // 2순위: 그 함수가 속한 '클래스(컨트롤러)' 전체에 스티커가 붙어있는가?
                context.getClass(),
            ]
        )

        // 서버로 들어온 HTTP 요청 상자(Request)를 가져옵니다.
        const req = context.switchToHttp().getRequest();

        // 공개 경로라면 '공개' 표시를 남기고 통과시킵니다.
        if (isPublic) {
            req.isRoutePublic = true;

            return true;
        }

        // Header에서 Authorization 항목을 꺼냅니다.
        const rawToken = req.headers['authorization'];

        // 토큰이 아예 없다면 바로 쫒아냅니다.
        if (!rawToken) {
            throw new UnauthorizedException('토큰이 없습니다!');
        }

        // Bearer xxx에서 "xxx"만 추출합니다.
        const token = this.authService.extractTokenFromHeader(rawToken, true);

        // 추출한 토큰이 위조되지 않았는지 검사합니다.
        const result = await this.authService.verifyToken(token);
        console.log(result);

        /**
         * request에 넣을 정보
         * 
         * 1) 사용자 정보 - user
         * 2) token - token
         * 3) tokenType - access | refresh
         */
        // 토큰 주인의 이메일로 DB에서 실제 유저 정보를 찾습니다.
        const user = await this.usersService.getUserByPhoneNumber(result.phoneNumber);

        // 요청 상자에 유저 정보와 토큰 정보를 담아둡니다.
        req.user = user;
        req.token = token;
        req.tokenType = result.type;

        // 모든 검사가 끝났으니 컨트롤러로 가도 좋다고 허락합니다.
        return true;
    }
}

    @Injectable()
    export class AccessTokenGuard extends BearerTokenGuard {
        async canActivate(context: ExecutionContext): Promise<boolean> {
            await super.canActivate(context);

            const req = context.switchToHttp().getRequest();

            if(req.isRoutePublic){
                return true;
            }

            if(req.tokenType !== 'access'){
                throw new UnauthorizedException('Access Token이 아닙니다.')
            }

            return true;
        }
    }

    @Injectable()
    export class RefreshTokenGuard extends BearerTokenGuard{
        async canActivate(context: ExecutionContext): Promise<boolean> {
            await super.canActivate(context);

            const req = context.switchToHttp().getRequest();

            if(req.isRoutePublic){
                return true;
            }

            if(req.tokenType !== 'refresh'){
                throw new UnauthorizedException('Refresh Token이 아닙니다.');
            }

            return true;
        }
    }
