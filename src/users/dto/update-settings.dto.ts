import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from "class-validator";
import { GenderEnum } from "../const/gender.const";
import { MAX_AGE, MIN_SIGNUP_AGE } from "../const/age.const";

/**
 * '만날 친구 설정' 화면에서 보내오는 값. (기획서 FE-Setting-001~003)
 *
 * ⚠️ 여기서 `@IsOptional()` 은 두 가지 뜻이 겹쳐 있다.
 *   · 아예 안 보냄  → 그 항목은 바꾸지 않는다
 *   · null 을 보냄  → '전체'로 바꾼다 (조건 없음)
 *
 * 그래서 서비스에서 `undefined` 와 `null` 을 구분해서 처리한다.
 * 둘을 같게 취급하면 "전체로 바꾸고 싶다"는 요청이 "안 바꾼다"가 돼버린다.
 */
export class UpdateSettingsDto {
    /** 만나고 싶은 지역. null 이면 전체 */
    @IsString({ message: '지역을 확인해주세요.' })
    @IsOptional()
    area?: string | null;

    /** 만나고 싶은 성별. null 이면 전체 */
    @IsEnum(GenderEnum, { message: '성별을 확인해주세요.' })
    @IsOptional()
    gender?: GenderEnum | null;

    @IsInt({ message: '나이를 확인해주세요.' })
    @Min(MIN_SIGNUP_AGE, { message: `나이는 ${MIN_SIGNUP_AGE}살부터 고를 수 있어요.` })
    @Max(MAX_AGE, { message: `나이는 ${MAX_AGE}살까지 고를 수 있어요.` })
    @IsOptional()
    minAge?: number;

    @IsInt({ message: '나이를 확인해주세요.' })
    @Min(MIN_SIGNUP_AGE, { message: `나이는 ${MIN_SIGNUP_AGE}살부터 고를 수 있어요.` })
    @Max(MAX_AGE, { message: `나이는 ${MAX_AGE}살까지 고를 수 있어요.` })
    @IsOptional()
    maxAge?: number;
}
