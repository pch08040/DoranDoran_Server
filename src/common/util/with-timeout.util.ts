import { DomainException } from '../exception/domain.exception';
import { ErrorCode } from '../const/error-code.const';

/** 바깥 저장소(Redis 등)를 기다려줄 최대 시간. 이걸 넘기면 실패로 친다 */
export const INFRA_TIMEOUT_MS = 2000;

/**
 * 정해진 시간 안에 끝나지 않으면 에러로 끊는다.
 *
 * 왜 필요한가
 *   Redis 가 죽어 있을 때 `cacheManager.get()` 은 에러를 내지 않는다.
 *   "곧 다시 연결되겠지" 하며 명령을 쌓아두고 **영원히 기다린다.**
 *   그러면 요청이 응답 없이 매달리고, 앱에서는 로딩 스피너가 안 멈춘다.
 *   (실제로 이 프로젝트에서 docker 를 안 켠 채 인증 API 를 부르니
 *    2분이 지나도 응답이 오지 않았다)
 *
 *   에러가 나는 것보다 **아무 일도 안 일어나는 것이 더 나쁘다.**
 *   사용자는 뭐가 잘못됐는지도 모른 채 기다리게 되고,
 *   서버 쪽에서도 요청이 계속 쌓여 자원을 잡아먹는다.
 *   차라리 2초 만에 끊고 "잠시 후 다시 시도해주세요" 를 띄우는 편이 낫다.
 *
 * 주의
 *   시간이 지나 끊더라도 원래 작업이 취소되지는 않는다.
 *   (JS 의 Promise 는 중간에 멈출 수 없다)
 *   우리는 '그 결과를 더 이상 기다리지 않을 뿐'이다. 캐시 읽기·쓰기라 문제되지 않는다.
 *
 * @param work 기다릴 작업
 * @param code 시간이 지났을 때 던질 에러 코드
 * @param ms   최대 대기 시간(밀리초)
 */
export async function withTimeout<T>(
    work: Promise<T>,
    code: ErrorCode = 'INFRA_UNAVAILABLE',
    ms: number = INFRA_TIMEOUT_MS,
): Promise<T> {
    let timer: NodeJS.Timeout | undefined;

    const timeout = new Promise<never>((_, reject) => {
        timer = setTimeout(() => reject(new DomainException(code)), ms);
    });

    try {
        // 둘 중 먼저 끝나는 쪽을 택한다. 작업이 빠르면 작업, 느리면 시간초과.
        return await Promise.race([work, timeout]);
    } finally {
        // 작업이 먼저 끝났으면 타이머를 치운다.
        // 안 치우면 서버가 종료될 때까지 타이머가 남아 프로세스가 안 꺼진다.
        if (timer) clearTimeout(timer);
    }
}
