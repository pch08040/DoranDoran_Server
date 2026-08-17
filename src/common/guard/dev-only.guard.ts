import { CanActivate, Injectable, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { ENV_NODE_ENV_KEY, PRODUCTION } from "../const/env-keys.const";

/**
 * 개발 중에만 열어두는 API에 붙이는 가드(문지기).
 *
 * 더미 데이터 생성, 전체 삭제 같은 기능은 개발할 때는 편하지만
 * 운영 서버에 열려 있으면 누구나 데이터를 날려버릴 수 있다.
 *
 * 운영 환경(NODE_ENV=production)에서는 404를 돌려줘서
 * 그런 주소가 아예 없는 것처럼 보이게 만든다.
 * (403으로 막으면 '있긴 있구나'라는 정보를 주게 되므로 404가 낫다)
 */
@Injectable()
export class DevOnlyGuard implements CanActivate {
    constructor(private readonly configService: ConfigService) { }

    canActivate(): boolean {
        const nodeEnv = this.configService.get<string>(ENV_NODE_ENV_KEY);

        if (nodeEnv === PRODUCTION) {
            throw new NotFoundException();
        }

        return true;
    }
}
