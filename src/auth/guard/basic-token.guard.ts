import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from "@nestjs/common";
import { AuthService } from "../auth.service";

/**
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
            throw new UnauthorizedException('토큰이 없습니다!');
        }

        // 토큰을 받아 구분한 뒤 token을 리턴
        const token = this.authService.extractTokenFromHeader(rawToken, false);

        // token을 decode해서 전화번호와 인증번호를 알아냄
        const credentials = this.authService.decodeBasicToken(token);

        req.user = credentials;

        return true;
    }
}