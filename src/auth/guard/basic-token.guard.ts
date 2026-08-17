import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import { AuthService } from "../auth.service";
import { DomainException } from "src/common/exception/domain.exception";

/**
 * ⚠️ 현재 **아무 데서도 쓰이지 않는다.** (2026-08-17 확인)
 *
 * 이메일+비밀번호 로그인을 전제로 만든 가드인데,
 * 도란도란은 비밀번호가 없고 전화번호 인증만 쓴다.
 * 아래 주석에 나오는 authenticateWithEmailAndPassword 는 존재하지도 않는 함수다.
 *
 * 지우지 않고 남겨둔 이유는 이 저장소가 git 으로 관리되고 있지 않아
 * 되돌릴 방법이 없기 때문이다. git 을 붙인 뒤 삭제할 것.
 *
 * ---
 * 구현할 기능
 *
 * 1) 요청객체 (request)를 불러오고
 *    authorization header로부터 토큰을 가져온다.
 * 2) authService.extractTokenFromHeader를 이용해서
 *    사용 할 수 있는 형태의 토큰을 추출한다.
 * 3) authService.decodeBasicToken을 실행해서
 *    email과 password를 추출한다.
 * 4) email과 password를 이용해서 사용자를 가져온다.
 *    authService.authenticateWithEmailAndPassword
 * 5) 찾아낸 사용자를 (1) 요청 객체에 붙여준다.
 *    req.user = user;
 */
@Injectable()
export class BasicTokenGuard implements CanActivate{
    constructor(private readonly authService: AuthService){}

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const req = context.switchToHttp().getRequest();

        // {authorization: 'Basic asdfasdfasdfasdf'}
        // asdfasdfasdfasdf
        const rawToken = req.headers['authorization'];

        if(!rawToken){
            throw new DomainException('AUTH_TOKEN_MISSING');
        }

        // 토큰을 받아 구분한 뒤 token을 리턴
        const token = this.authService.extractTokenFromHeader(rawToken, false);

        // token을 decode해서 전화번호와 인증번호를 알아냄
        const credentials = this.authService.decodeBasicToken(token);

        req.user = credentials;

        return true;
    }
}