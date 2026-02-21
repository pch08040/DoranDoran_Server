import { SetMetadata } from "@nestjs/common";

// 데이터를 저장할 때 쓸 이름표 정의
export const IS_PUBLIC_KEY = 'is_public';

// 이 데코레이터가 붙은 함수는 key: is_public, value: true
export const IsPublic = () => SetMetadata(IS_PUBLIC_KEY, true);