import { IsIn, IsNumber, IsOptional } from "class-validator";

/**
 * 목록 조회(페이지네이션)에서 공통으로 받는 값들.
 *
 * ⚠️ 검증마다 message 를 적어둘 것. 안 적으면 영어 기본 문구가 만들어지고,
 *    그건 사용자에게 보여줄 수 없어 "입력한 정보를 다시 확인해주세요."로 대체된다.
 *
 * 여기 값들은 사용자가 직접 입력하는 게 아니라 앱이 만들어 보낸다.
 * 그래서 문구도 '무엇을 고쳐라'가 아니라 '잘못된 요청이다' 쪽에 가깝다.
 */
export class BasePaginationDto {
    @IsNumber({}, { message: '목록 조회 조건이 올바르지 않습니다.' })
    @IsOptional()
    where__id__less_than?: number;

    // 이전 마지막 데이터의 ID
    // 이 프로퍼티에 입력된 ID 보다 높은 ID 부터 값을 가져오기
    @IsNumber({}, { message: '목록 조회 조건이 올바르지 않습니다.' })
    @IsOptional()
    where__id__more_than?: number;

    // 정렬
    // createdAt => 생성된 시간의 내림차/오름차 순으로 정렬
    @IsIn(['ASC', 'DESC'], { message: '정렬 방식이 올바르지 않습니다.' })
    @IsOptional()
    order__createdAt: 'ASC' | 'DESC' = 'ASC';

    // 몇개의 데이터를 응답으로 받을지
    @IsNumber({}, { message: '가져올 개수가 올바르지 않습니다.' })
    @IsOptional()
    take: number = 20;
}
