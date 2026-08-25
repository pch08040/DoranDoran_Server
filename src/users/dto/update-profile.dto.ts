import { IsEnum, IsInt, IsNotEmpty, IsOptional, IsString, Max, MaxLength, Min } from "class-validator";
import { GenderEnum } from "../const/gender.const";
import { MAX_AGE, MIN_SIGNUP_AGE } from "../const/age.const";

/**
 * 프로필 설정 화면에서 보내오는 값들.
 *
 * ⚠️ 모든 검증에 message 를 반드시 적을 것.
 *   안 적으면 class-validator 가 영어 기본 문구를 만든다.
 *     "gender must be one of the following values: 남성, 여성"
 *   이건 그대로 사용자 화면에 뜬다. (예외 필터는 문구를 만들어내지 못한다)
 *   여기 적는 문구가 곧 사용자가 읽을 문장이다.
 */
export class UpdateProfileDto {
  @IsString({ message: '이름을 확인해주세요.' })
  @IsNotEmpty({ message: '이름은 반드시 입력해야 합니다.' })
  firstName: string;

  // 나이는 숫자다. 앱이 '20' 처럼 문자열로 보내도
  // ValidationPipe 의 enableImplicitConversion 이 숫자로 바꿔준다.
  @IsInt({ message: '나이를 확인해주세요.' })
  @Min(MIN_SIGNUP_AGE, { message: `만 ${MIN_SIGNUP_AGE}세 이상만 가입할 수 있어요.` })
  @Max(MAX_AGE, { message: '나이를 확인해주세요.' })
  age: number;

  @IsString({ message: '지역을 확인해주세요.' })
  @IsNotEmpty({ message: '지역을 선택해주세요.' })
  area: string;

  // 앱은 서버 enum 값('남성' / '여성')을 그대로 보낸다.
  // 앱에서 'MALE' 같은 값으로 바꿔 보내면 여기서 걸린다.
  @IsEnum(GenderEnum, { message: '성별을 선택해주세요.' })
  gender: GenderEnum;

  // 자기소개는 선택 항목이다. (기획서 FE-SignUP-016: 최대 20자)
  // 예전에 @IsNotEmpty()가 붙어 있어서, 자기소개를 안 쓰면
  // '가입 완료'가 400 에러로 막혀버렸다.
  @IsString({ message: '자기소개를 확인해주세요.' })
  @MaxLength(20, { message: '자기소개는 최대 20자까지 입력할 수 있습니다.' })
  @IsOptional()
  bio?: string;

  // 사진 파일이 아니라, 미리 업로드해둔 임시 이미지의 '경로' 목록이다.
  @IsString({ each: true, message: '사진 정보가 올바르지 않습니다.' })
  @IsOptional()
  profileImages?: string[] = [];
}
