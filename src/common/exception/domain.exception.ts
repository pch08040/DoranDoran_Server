import { HttpException } from '@nestjs/common';
import { ERROR_CODES, ErrorCode } from '../const/error-code.const';

/**
 * 우리 서비스가 의도적으로 던지는 예외.
 *
 * 쓰는 법
 *   throw new DomainException('AUTH_CODE_MISMATCH');
 *
 * 상태 코드(401/400/404...)와 사용자 문구는 error-code.const.ts 가 갖고 있으므로
 * 던지는 쪽은 '무엇이 잘못됐는지'만 말하면 된다.
 *
 * 왜 UnauthorizedException 을 그대로 안 쓰는가
 *   NestJS 기본 예외는 code 를 담을 자리가 없다.
 *   그래서 앱은 상태 코드(401)만 보게 되는데, 401 하나에 '토큰 없음'과 '토큰 만료'가
 *   섞여 있어서 앱이 어떤 행동을 해야 할지 판단할 수 없었다.
 *
 * ErrorCode 타입 덕분에 오타는 컴파일 단계에서 걸린다.
 *   throw new DomainException('AUTH_CODE_MISMACH')  // ← 빨간 줄
 */
export class DomainException extends HttpException {
    /** 앱이 보고 분기하는 값 */
    readonly code: ErrorCode;

    /**
     * @param code    error-code.const.ts 에 정의된 키
     * @param message 기본 문구 대신 다른 문구를 쓰고 싶을 때만. 보통은 생략한다
     * @param details 개발자용 부가 정보. 어떤 항목이 왜 틀렸는지 등.
     *                운영 환경에서는 응답에 실리지 않고 로그로만 남는다
     */
    constructor(code: ErrorCode, message?: string, details?: string[]) {
        const preset = ERROR_CODES[code];

        super({ code, message: message ?? preset.message, details }, preset.status);

        this.code = code;
    }
}
