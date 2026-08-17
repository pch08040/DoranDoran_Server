/**
 * Google Cloud Storage(구글 파일 창고) 안에서의 폴더 경로.
 *
 * 창고에는 진짜 '폴더'가 없고, 파일 이름 앞에 붙는 글자로 폴더처럼 구분한다.
 *   temp/3f9a-1b2c.png   ← 'temp/' 부분이 폴더 역할
 *   users/3f9a-1b2c.png
 *
 * 예전에는 서버 컴퓨터의 실제 폴더 경로(/Users/.../public/users)를 썼지만,
 * 배포하면 컨테이너가 교체될 때마다 그 폴더가 통째로 사라지기 때문에 창고 방식으로 바꿨다.
 */

/** 가입이 아직 확정되지 않은 임시 사진. 1일 뒤 창고의 수명주기 규칙이 자동으로 지운다. */
export const TEMP_PREFIX = 'temp/';

/** 프로필 사진 */
export const USERS_PREFIX = 'users/';

/** 게시글(와글와글) 사진 */
export const POSTS_PREFIX = 'posts/';

/** 사진을 한 장도 등록하지 않은 사용자에게 대신 보여줄 기본 프로필 */
export const DEFAULT_PROFILE_OBJECT = `${USERS_PREFIX}basicProfile.png`;
