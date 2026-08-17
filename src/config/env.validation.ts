import { plainToInstance } from 'class-transformer';
import { IsIn, IsNotEmpty, IsNumber, IsString, validateSync } from 'class-validator';

/**
 * .env 파일에 반드시 있어야 하는 값들의 목록과 조건.
 *
 * 서버가 켜지는 순간 이 조건들을 검사해서, 하나라도 안 맞으면 서버를 아예 띄우지 않는다.
 *
 * 왜 이렇게 하나?
 *   값이 빠져 있어도 서버는 일단 정상적으로 뜬다. 그리고 한참 뒤,
 *   사용자가 로그인을 시도하는 순간에야 엉뚱한 에러로 터진다.
 *   원인(.env 한 줄 누락)과 증상(로그인 실패)이 멀리 떨어져 있어서 찾기가 어렵다.
 *
 *   특히 배포할 때 위험하다. 환경변수 하나를 빠뜨려도 '배포 성공'이라고 나오고,
 *   실제로는 고장난 서버가 돌아간다.
 *
 *   그래서 "조용히 고장난 채로 도는 것보다 시끄럽게 안 뜨는 게 낫다"는 쪽을 택했다.
 *
 * DTO에서 쓰던 @IsString() 같은 데코레이터를 그대로 쓴다.
 */
export class EnvironmentVariables {
    // ── 실행 환경 ────────────────────────────────
    @IsIn(['development', 'production'], {
        message: 'NODE_ENV 는 development 또는 production 이어야 합니다.',
    })
    NODE_ENV: string;

    // ── 서버 ────────────────────────────────────
    /** Cloud Run에 배포하면 이 값을 플랫폼이 직접 주입한다 */
    @IsNumber({}, { message: 'PORT 는 숫자여야 합니다.' })
    PORT: number;

    @IsIn(['http', 'https'])
    SERVER_PROTOCOL: string;

    @IsString()
    @IsNotEmpty()
    SERVER_HOST: string;

    @IsNumber()
    SERVER_PORT: number;

    // ── 인증 ────────────────────────────────────
    /**
     * 토큰에 서명할 때 쓰는 비밀 문자열.
     * 이 값이 유출되면 아무나 남의 토큰을 위조할 수 있으므로
     * 운영에서는 반드시 길고 무작위인 값을 쓴다.
     */
    @IsString()
    @IsNotEmpty({ message: 'JWT_SECRET 이 비어 있습니다. 토큰 서명에 반드시 필요합니다.' })
    JWT_SECRET: string;

    // ── 데이터베이스 ─────────────────────────────
    @IsString()
    @IsNotEmpty()
    DB_HOST: string;

    @IsNumber()
    DB_PORT: number;

    @IsString()
    @IsNotEmpty()
    DB_USER: string;

    @IsString()
    @IsNotEmpty()
    DB_PASSWORD: string;

    @IsString()
    @IsNotEmpty()
    DB_NAME: string;

    // ── Redis (인증번호 3분 보관용) ───────────────
    @IsString()
    @IsNotEmpty()
    REDIS_HOST: string;

    @IsNumber()
    REDIS_PORT: number;

    // ── 사진 저장소 ──────────────────────────────
    /**
     * Google Cloud Storage 버킷 이름.
     * 개발과 운영이 서로 다른 버킷을 쓰므로 환경변수로 분리한다.
     * (접속 인증은 여기 없다. gcloud 로그인 또는 Cloud Run 서비스 계정이 자동 처리)
     */
    @IsString()
    @IsNotEmpty({ message: 'GCS_BUCKET 이 비어 있습니다. 사진을 저장할 버킷 이름이 필요합니다.' })
    GCS_BUCKET: string;
}

/**
 * ConfigModule이 서버 시작 시 호출하는 검사 함수.
 * 문제가 있으면 예외를 던져 서버 기동 자체를 막는다.
 */
export function validateEnv(config: Record<string, unknown>) {
    // .env의 값은 전부 문자열이라 숫자 항목은 변환이 필요하다.
    // enableImplicitConversion이 '3000' → 3000 으로 바꿔준다.
    const validated = plainToInstance(EnvironmentVariables, config, {
        enableImplicitConversion: true,
    });

    const errors = validateSync(validated, { skipMissingProperties: false });

    if (errors.length > 0) {
        // 어떤 값이 왜 문제인지 한눈에 보이도록 정리해서 출력한다.
        const messages = errors
            .map((e) => `  · ${e.property}: ${Object.values(e.constraints ?? {}).join(', ')}`)
            .join('\n');

        throw new Error(
            `\n\n❌ 환경변수 설정에 문제가 있어 서버를 시작할 수 없습니다.\n\n${messages}\n\n` +
            `.env 파일을 확인하세요. (최초 설정이라면: cp .env.example .env)\n`,
        );
    }

    return validated;
}
