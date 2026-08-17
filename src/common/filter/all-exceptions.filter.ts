import {
    ArgumentsHost,
    Catch,
    ExceptionFilter,
    HttpException,
    HttpStatus,
    Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { DomainException } from '../exception/domain.exception';
import { ERROR_CODES, ErrorCode, ErrorResponse } from '../const/error-code.const';

/**
 * 서버에서 발생한 **모든** 예외가 마지막으로 거쳐 가는 곳.
 *
 * `@Catch()` 를 괄호 안 없이 쓰면 '전부 다 잡는다'는 뜻이다.
 *
 * 하는 일은 두 가지다.
 *   1. 어떤 예외든 항상 **똑같은 모양의 JSON** 으로 바꿔서 내보낸다
 *   2. 개발자용 정보(스택 추적 등)가 사용자에게 새어나가지 않게 막는다
 *
 * 이게 없을 때 어떤 모양이었냐면 —
 *   {"message":["정확한 번호를 입력해주세요!"],"error":"Bad Request","statusCode":400}
 *   {"message":"토큰이 없습니다!","error":"Unauthorized","statusCode":401}
 *   {"message":"Cannot GET /auth/nope","error":"Not Found","statusCode":404}
 *
 * message 가 배열일 때도 문자열일 때도 있어서 앱이 매번 분기해야 했고,
 * "Cannot GET ..." 같은 개발자용 영어 문장이 그대로 나갔다.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
    private readonly logger = new Logger('Exception');

    catch(exception: unknown, host: ArgumentsHost) {
        const ctx = host.switchToHttp();
        const response = ctx.getResponse<Response>();
        const request = ctx.getRequest<Request>();

        const { code, message, status, details } = this.classify(exception);

        // 500번대는 우리가 예상하지 못한 오류다. 원인을 찾을 수 있게 통째로 남긴다.
        // (사용자에게는 안 보내고 서버 로그에만 남는다)
        if (status >= HttpStatus.INTERNAL_SERVER_ERROR) {
            this.logger.error(
                `${request.method} ${request.url} → ${code}`,
                exception instanceof Error ? exception.stack : String(exception),
            );
        } else {
            // 4xx는 대부분 사용자가 잘못 입력한 것이라 한 줄이면 충분하다.
            //
            // 다만 원래 문구는 같이 남긴다. 사용자에게 나가는 문구는 우리 것으로 갈아끼우기 때문에,
            // 로그에도 안 남기면 개발 중에 무엇이 틀렸는지 알 방법이 없어진다.
            // (예: 페이지네이션 필터 키가 잘못됐을 때의 안내 문구)
            const original =
                exception instanceof HttpException ? this.rawMessage(exception) : '';

            this.logger.warn(
                `${request.method} ${request.url} → ${code} (${status})${original ? ` | ${original}` : ''}`,
            );
        }

        const body: ErrorResponse = {
            code,
            message,
            statusCode: status,
            path: request.url,
            ...(details ? { details } : {}),
        };

        response.status(status).json(body);
    }

    /**
     * 던져진 예외가 무엇이냐에 따라 code·문구·상태를 정한다.
     */
    private classify(exception: unknown): {
        code: ErrorCode;
        message: string;
        status: number;
        details?: string[];
    } {
        // ① 우리가 의도적으로 던진 예외 — code 가 이미 들어있다
        //    (입력 검증 실패도 validation-exception.factory.ts 를 거쳐 여기로 온다)
        if (exception instanceof DomainException) {
            const payload = exception.getResponse() as {
                code: ErrorCode;
                message: string;
                details?: string[];
            };

            return {
                code: payload.code,
                message: payload.message,
                status: exception.getStatus(),
                // 개발할 때는 어떤 항목이 왜 틀렸는지 보이는 편이 낫지만,
                // 운영에서는 내부 구조가 드러나므로 내보내지 않는다.
                details: this.isProduction ? undefined : payload.details,
            };
        }

        // ② NestJS가 만든 예외 — ValidationPipe(입력 검증), 없는 주소 등
        if (exception instanceof HttpException) {
            const status = exception.getStatus();
            const payload = exception.getResponse();

            // NestJS 예외는 상태 코드로 종류를 짐작한다.
            // 이 자리에 오는 건 우리가 안 만든 예외뿐이므로 문구는 무조건 우리 것으로 갈아끼운다.
            // ("Cannot GET /auth/nope" 같은 영어 문장이 사용자에게 나가면 안 된다)
            const code = this.codeByStatus(status);

            return {
                code,
                message: ERROR_CODES[code].message,
                status,
            };
        }

        // ③ 예상 못 한 오류 (DB 연결 끊김, 코드 버그 등)
        //    사용자에게는 원인을 알려주지 않는다. 로그로만 남긴다.
        return {
            code: 'INTERNAL_ERROR',
            message: ERROR_CODES.INTERNAL_ERROR.message,
            status: HttpStatus.INTERNAL_SERVER_ERROR,
        };
    }

    private get isProduction(): boolean {
        return process.env.NODE_ENV === 'production';
    }

    /** 예외가 원래 갖고 있던 문구. 로그에만 쓴다 */
    private rawMessage(exception: HttpException): string {
        const payload = exception.getResponse();

        if (typeof payload === 'string') return payload;

        const message = (payload as { message?: unknown }).message;

        if (Array.isArray(message)) return message.join(', ');
        if (typeof message === 'string') return message;

        return '';
    }

    private codeByStatus(status: number): ErrorCode {
        switch (status) {
            case HttpStatus.UNAUTHORIZED:
                return 'AUTH_TOKEN_INVALID';
            case HttpStatus.NOT_FOUND:
                return 'NOT_FOUND';
            case HttpStatus.SERVICE_UNAVAILABLE:
                return 'INFRA_UNAVAILABLE';
            default:
                return status >= HttpStatus.INTERNAL_SERVER_ERROR
                    ? 'INTERNAL_ERROR'
                    : 'REQUEST_FAILED';
        }
    }
}
