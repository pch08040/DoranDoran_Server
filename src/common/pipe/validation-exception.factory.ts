import { ValidationError } from 'class-validator';
import { DomainException } from '../exception/domain.exception';

/**
 * `forbidNonWhitelisted` 위반일 때 class-validator 가 붙이는 규칙 이름.
 * "property xxx should not exist" 문구가 여기서 나온다.
 */
const WHITELIST_RULE = 'whitelistValidation';

/**
 * 입력 검증(ValidationPipe)이 실패했을 때 어떤 예외를 던질지 정한다.
 *
 * 왜 필요한가
 *   class-validator 는 우리가 message 를 안 적으면 **영어 기본 문구**를 만든다.
 *     "property 해킹 should not exist"
 *     "gender must be one of the following values: 남성, 여성"
 *   이걸 그대로 화면에 띄우면 사용자는 무슨 말인지 알 수 없다.
 *
 * 처음에는 '한글이 들어있으면 우리가 쓴 문구'로 판별하려 했는데 실패했다.
 * 필드 이름이 한글이면 영어 기본 문구에도 한글이 섞여 들어오기 때문이다.
 *   "property 해킹 should not exist"  ← 한글이 있지만 우리 문구가 아니다
 *
 * 그래서 글자로 추측하지 않고 **어떤 규칙이 실패했는지를 직접 본다.**
 *   · whitelistValidation 위반 → 앱이 이상한 값을 보낸 것. 사용자는 고칠 수 없다 → 감춘다
 *   · 그 외 → DTO 에 우리가 적은 문구가 있으면 그걸 쓴다
 */
export function validationExceptionFactory(errors: ValidationError[]) {
    const all = flatten(errors);

    // 사용자에게 보여줄 후보를 고른다.
    //  · whitelist 위반 → 앱이 이상한 값을 보낸 것이라 사용자가 고칠 수 없다
    //  · 라이브러리 기본 문구 → 영어라서 보여줘도 못 읽는다
    const shown = all
        .filter((e) => e.rule !== WHITELIST_RULE && !isLibraryDefault(e))
        .map((e) => e.message);

    return new DomainException(
        'VALIDATION_FAILED',
        // 여러 개가 틀렸어도 첫 번째만 보여준다. 전부 나열하면 읽기 어렵다.
        // 보여줄 게 하나도 없으면(= 전부 앱 잘못) 기본 문구가 쓰인다.
        shown[0],
        // 개발자용. 감춘 것까지 전부 담는다
        all.map((e) => `${e.field}: ${e.message}`),
    );
}

/**
 * class-validator 가 자동으로 만든 영어 문구인지 판별한다.
 *
 * 기본 문구는 예외 없이 **필드 이름으로 시작**한다.
 *   "gender must be one of the following values: 남성, 여성"
 *   "age should not be empty"
 *   "each value in profileImages must be a string"
 *
 * 반면 우리가 DTO 에 적는 문구는 사람에게 하는 말이라 필드 이름으로 시작하지 않는다.
 *   "성별을 선택해주세요."
 *
 * 이 판별이 하는 일은 **안전장치**다.
 * 원칙은 DTO 마다 message 를 적는 것이고, 이건 빠뜨렸을 때
 * 영어가 사용자에게 새어나가지 않게 막아주는 마지막 그물이다.
 * (여기 걸리면 사용자는 "입력한 정보를 다시 확인해주세요."만 보게 되므로,
 *  details 로그를 보고 DTO 에 문구를 채워 넣어야 한다)
 */
function isLibraryDefault(error: { field: string; message: string }): boolean {
    const leaf = error.field.split('.').pop() ?? error.field;

    return (
        error.message.startsWith(`${leaf} `) ||
        // 배열 항목 검사(each: true)일 때의 형태
        error.message.startsWith(`each value in ${leaf} `)
    );
}

/**
 * 중첩된 검증 오류를 평평한 목록으로 편다.
 *
 * ValidationError 는 children 을 가질 수 있다.
 * 예) profileImages 배열 안의 3번째 항목이 틀렸다면
 *     profileImages → children[2] → constraints 형태로 들어온다.
 */
function flatten(
    errors: ValidationError[],
    parentPath = '',
): Array<{ field: string; rule: string; message: string }> {
    const result: Array<{ field: string; rule: string; message: string }> = [];

    for (const error of errors) {
        const field = parentPath ? `${parentPath}.${error.property}` : error.property;

        // constraints 는 { 규칙이름: 문구 } 형태다
        for (const [rule, message] of Object.entries(error.constraints ?? {})) {
            result.push({ field, rule, message });
        }

        if (error.children?.length) {
            result.push(...flatten(error.children, field));
        }
    }

    return result;
}
