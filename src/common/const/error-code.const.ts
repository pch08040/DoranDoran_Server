import { HttpStatus } from '@nestjs/common';

/**
 * 서버가 낼 수 있는 모든 에러의 사전(dictionary).
 *
 * 왜 이런 걸 만드는가
 *   예전에는 예외를 던질 때마다 그 자리에서 문구를 적었다.
 *     throw new UnauthorizedException('인증번호가 일치하지 않습니다.')
 *
 *   그러면 앱이 기댈 수 있는 건 상태 코드(401) 하나뿐이다.
 *   그런데 '토큰 없음'도 401이고 '토큰 만료'도 401이라,
 *   앱은 둘을 구분하지 못한 채 똑같이 처리할 수밖에 없었다.
 *   (만료면 재발급해서 재시도해야 하고, 없으면 로그인 화면으로 보내야 하는데도)
 *
 *   여기서 코드(code)를 붙이면 앱이 '무엇이 잘못됐는지'를 정확히 알 수 있다.
 *
 * 규칙
 *   1. code 는 한 번 정하면 바꾸지 않는다. 앱이 이 문자열을 보고 분기하기 때문이다.
 *      (문구는 바꿔도 되지만 code 를 바꾸면 앱이 못 알아본다)
 *   2. message 는 그대로 사용자에게 보여줘도 되는 한국어여야 한다.
 *      앱이 모르는 code 를 만나면 이 문구를 그대로 띄운다.
 *   3. 개발자용 정보(스택 추적, SQL 오류 등)는 절대 넣지 않는다. 로그로만 남긴다.
 */
export const ERROR_CODES = {
    // ── 인증 · 토큰 ────────────────────────────────────────────
    /** authorization 헤더가 아예 없음 → 앱: 로그인 화면으로 */
    AUTH_TOKEN_MISSING: {
        status: HttpStatus.UNAUTHORIZED,
        message: '로그인이 필요합니다.',
    },
    /** 토큰이 만료됐거나 위조됨 → 앱: 재발급 시도 후 재요청 */
    AUTH_TOKEN_INVALID: {
        status: HttpStatus.UNAUTHORIZED,
        message: '로그인이 만료되었습니다. 다시 로그인해주세요.',
    },
    /** access 자리에 refresh 를 냈거나 그 반대 → 앱: 재발급해도 소용없음 */
    AUTH_TOKEN_TYPE_MISMATCH: {
        status: HttpStatus.UNAUTHORIZED,
        message: '로그인 정보가 올바르지 않습니다. 다시 로그인해주세요.',
    },

    // ── 전화번호 인증 ──────────────────────────────────────────
    /** 3분이 지났거나 발송한 적이 없음 */
    AUTH_CODE_EXPIRED: {
        status: HttpStatus.BAD_REQUEST,
        message: '인증번호가 만료되었어요.\n다시 받아주세요.',
    },
    /** 번호는 살아있는데 입력값이 틀림 */
    AUTH_CODE_MISMATCH: {
        status: HttpStatus.UNAUTHORIZED,
        message: '인증번호가 일치하지 않아요.\n다시 확인해주세요.',
    },

    // ── 유저 · 프로필 ──────────────────────────────────────────
    USER_NOT_FOUND: {
        status: HttpStatus.NOT_FOUND,
        message: '회원 정보를 찾을 수 없어요.\n다시 인증해주세요.',
    },
    PROFILE_INCOMPLETE: {
        status: HttpStatus.BAD_REQUEST,
        message: '가입 완료를 위해 모든 정보를 입력해주세요.',
    },

    // ── 신고 · 차단 ────────────────────────────────────────────
    /** 같은 사람을 두 번 신고하려 함 */
    ALREADY_REPORTED: {
        status: HttpStatus.CONFLICT,
        message: '이미 신고한 회원이에요.',
    },
    /**
     * 차단 관계라 볼 수 없음.
     *
     * 내가 차단했든 상대가 나를 차단했든 같은 코드를 준다.
     * 구분해서 알려주면 "저 사람이 나를 차단했구나"를 알게 되어
     * 오히려 갈등을 키운다.
     */
    USER_BLOCKED: {
        status: HttpStatus.FORBIDDEN,
        message: '지금은 볼 수 없는 회원이에요.',
    },

    // ── 이야기 (채팅) ──────────────────────────────────────────
    /** 없는 방이거나, 내가 속하지 않은 방 */
    CHAT_ROOM_NOT_FOUND: {
        status: HttpStatus.NOT_FOUND,
        message: '대화방을 찾을 수 없어요.',
    },
    /**
     * 내가 이미 나간 방에 글을 쓰려 함.
     *
     * 어떤 상황이냐면 — 목록에서 '나가기'를 눌렀는데 채팅방 화면이 아직 떠 있고,
     * 거기서 메시지를 보내는 경우다. 앱이 이 코드를 받으면 화면을 닫는다.
     */
    CHAT_ROOM_LEFT: {
        status: HttpStatus.FORBIDDEN,
        message: '이미 나간 대화방이에요.',
    },
    /**
     * 상대가 먼저 나간 방에 글을 쓰려 함. (시안: 대화방_상대방 종료.png)
     * 그 화면에는 입력창 대신 '대화방 나가기' 버튼만 남는다.
     */
    CHAT_PARTNER_LEFT: {
        status: HttpStatus.FORBIDDEN,
        message: '상대방이 이야기를 나갔어요.',
    },

    // ── 이미지 ────────────────────────────────────────────────
    IMAGE_NOT_FOUND: {
        status: HttpStatus.NOT_FOUND,
        message: '존재하지 않는 사진이에요.',
    },
    IMAGE_FORBIDDEN: {
        status: HttpStatus.FORBIDDEN,
        message: '본인의 사진만 삭제할 수 있어요.',
    },
    IMAGE_UPLOAD_FAILED: {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: '사진 업로드에 실패했어요.\n잠시 후 다시 시도해주세요.',
    },

    // ── 공통 ──────────────────────────────────────────────────
    /** DTO 검증 실패. 어떤 항목이 틀렸는지는 details 에 담긴다 */
    VALIDATION_FAILED: {
        status: HttpStatus.BAD_REQUEST,
        message: '입력한 정보를 다시 확인해주세요.',
    },
    /** 없는 주소 */
    NOT_FOUND: {
        status: HttpStatus.NOT_FOUND,
        message: '요청하신 정보를 찾을 수 없어요.',
    },
    /**
     * 우리가 따로 분류하지 않은 4xx.
     * 예) 파일 용량 초과(413), 허용하지 않는 메서드(405)
     * 이 코드가 로그에 자주 보이면 그때 전용 코드를 만들어 주면 된다.
     */
    REQUEST_FAILED: {
        status: HttpStatus.BAD_REQUEST,
        message: '요청을 처리할 수 없어요.\n다시 시도해주세요.',
    },
    /**
     * Redis·DB 같은 바깥 저장소가 응답하지 않음.
     *
     * 이게 없으면 어떤 일이 벌어지냐면 — Redis 가 죽었을 때
     * 요청이 에러도 안 내고 **영원히 매달린다.** 앱에서는 로딩 스피너가 안 멈춘다.
     * 차라리 몇 초 안에 끊고 "잠시 후 다시" 를 띄우는 편이 낫다.
     */
    INFRA_UNAVAILABLE: {
        status: HttpStatus.SERVICE_UNAVAILABLE,
        message: '일시적인 오류가 발생했어요.\n잠시 후 다시 시도해주세요.',
    },
    /** 서버가 예상하지 못한 오류. 자세한 내용은 서버 로그에만 남긴다 */
    INTERNAL_ERROR: {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        message: '일시적인 오류가 발생했어요.\n잠시 후 다시 시도해주세요.',
    },
} as const;

/** 'AUTH_CODE_EXPIRED' | 'USER_NOT_FOUND' | ... 처럼 위 키만 허용하는 타입 */
export type ErrorCode = keyof typeof ERROR_CODES;

/** 앱이 받게 될 에러 응답의 모양 */
export interface ErrorResponse {
    /** 앱이 보고 분기하는 값. 절대 바뀌지 않는다 */
    code: ErrorCode;
    /** 앱이 모르는 code 일 때 그대로 띄울 한국어 문구 */
    message: string;
    statusCode: number;
    /** 어떤 주소에서 났는지. 문의가 들어왔을 때 찾기 쉬우라고 */
    path: string;
    /** 검증 실패일 때 어떤 항목이 틀렸는지 (그 외에는 없음) */
    details?: string[];
}
