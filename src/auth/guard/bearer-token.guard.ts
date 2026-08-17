import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { DomainException } from "src/common/exception/domain.exception";
import { AuthService } from "../auth.service";
import { UsersService } from "src/users/users.service";
import { Reflector } from "@nestjs/core";
import { IS_PUBLIC_KEY } from "src/common/decorator/is-public.decorator";

@Injectable()
export class BearerTokenGuard implements CanActivate {
    constructor(
        private readonly authService: AuthService,
        private readonly usersService: UsersService,
        // 자식 클래스(AccessTokenGuard)에서도 써야 하므로 protected
        protected readonly reflector: Reflector
    ) { }

    /**
     * 이 부모 가드는 오직 'Bearer 토큰을 검증해서 req에 붙이는 일'만 한다.
     *
     * @IsPublic() 통과 처리는 여기 두면 안 된다.
     * 여기 두면 @UseGuards(RefreshTokenGuard)처럼 명시적으로 붙인 가드까지
     * 같이 무력화되어 검증 없이 통과해버린다. (전역 가드인 AccessTokenGuard가 담당)
     */
    async canActivate(context: ExecutionContext): Promise<boolean> {

        // 서버로 들어온 HTTP 요청 상자(Request)를 가져옵니다.
        const req = context.switchToHttp().getRequest();

        // Header에서 Authorization 항목을 꺼냅니다.
        const rawToken = req.headers['authorization'];

        // 토큰이 아예 없다면 바로 쫒아냅니다.
        //
        // '없음'과 '만료됨'을 다른 코드로 구분하는 것이 중요하다.
        // 앱 입장에서 만료는 '재발급받아 다시 시도'지만,
        // 없음은 재발급해도 소용없으니 '로그인 화면으로' 가야 한다.
        if (!rawToken) {
            throw new DomainException('AUTH_TOKEN_MISSING');
        }

        // Bearer xxx에서 "xxx"만 추출합니다.
        const token = this.authService.extractTokenFromHeader(rawToken, true);

        // 추출한 토큰이 위조되지 않았는지 검사합니다.
        const result = this.authService.verifyToken(token);

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
        const req = context.switchToHttp().getRequest();

        // 이 가드는 app.module.ts에 APP_GUARD로 등록된 '전역 가드'다.
        // 따라서 @IsPublic() 통과 처리는 여기서 담당한다.
        // reflector.getAllAndOverride: 1순위 핸들러(함수) → 2순위 클래스(컨트롤러) 순으로 찾는다.
        const isPublic = this.reflector.getAllAndOverride(
            IS_PUBLIC_KEY,
            [context.getHandler(), context.getClass()],
        );

        if (isPublic) {
            req.isRoutePublic = true;

            return true;
        }

        await super.canActivate(context);

        if (req.tokenType !== 'access') {
            throw new DomainException('AUTH_TOKEN_TYPE_MISMATCH');
        }

        return true;
    }
}

@Injectable()
export class RefreshTokenGuard extends BearerTokenGuard {
    async canActivate(context: ExecutionContext): Promise<boolean> {
        // 라우트에 직접 붙이는 가드이므로 @IsPublic()이어도 무조건 검증한다.
        // (리프레시 토큰 자체가 인증 수단이라 여기를 건너뛰면 안 된다)
        await super.canActivate(context);

        const req = context.switchToHttp().getRequest();

        if (req.tokenType !== 'refresh') {
            throw new DomainException('AUTH_TOKEN_TYPE_MISMATCH');
        }

        return true;
    }
}
