// 실행 환경 -> development / production
// 개발 편의 기능(인증번호 로그 출력, 더미 데이터 생성 API 등)을 켜고 끄는 기준
export const ENV_NODE_ENV_KEY = 'NODE_ENV';
// 운영 환경을 나타내는 값
export const PRODUCTION = 'production';

// 서버 프로토콜 -> http / https
export const ENV_PROTOCOL_KEY = 'SERVER_PROTOCOL';
// 서버 호스트 -> localhost
export const ENV_HOST_KEY = 'SERVER_HOST';
// 서버 포트번호 -> 3000
export const ENV_PORT_KEY = 'SERVER_PORT';

// JWT 토큰 시크릿 -> codefactory
export const ENV_JWT_SECRET_KEY = 'JWT_SECRET';
// JWT 토큰 해시 라운드 수 -> 10
export const ENV_HASH_ROUNDS = 'HASH_ROUNDS';

// 데이터베이스 호스트 -> localhost
export const ENV_DB_HOST_KEY = 'DB_HOST';
// 데이터베이스 포트 -> 5432
export const ENV_DB_PORT_KEY = 'DB_PORT';
// 데이터베이스 사용자 이름 -> postgres
export const ENV_DB_USERNAME_KEY = 'DB_USER';
// 데이터베이스 사용자 비밀번호 -> postgres
export const ENV_DB_PASSWORD_KEY = 'DB_PASSWORD';
// 데이터베이스 이름
export const ENV_DB_DATABASE_KEY = 'DB_NAME';

// Redis 호스트 -> localhost (배포하면 외부 Redis 주소로 바뀐다)
export const ENV_REDIS_HOST_KEY = 'REDIS_HOST';
// Redis 포트 -> 6379
export const ENV_REDIS_PORT_KEY = 'REDIS_PORT';

// 사진을 보관할 Google Cloud Storage 버킷 이름
// 개발: dorandoran-462503-images-dev / 운영: dorandoran-462503-images
//
// 인증(로그인)은 여기에 적지 않는다.
//  - 로컬  : gcloud auth application-default login 으로 만든 자격증명을 라이브러리가 자동으로 찾아 씀
//  - 배포후 : Cloud Run이 서비스 계정을 자동으로 붙여줌
// 그래서 비밀번호나 키 파일을 코드/환경변수에 둘 일이 없다.
export const ENV_GCS_BUCKET_KEY = 'GCS_BUCKET';