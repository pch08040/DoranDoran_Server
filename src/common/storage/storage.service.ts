import { Injectable, Logger } from '@nestjs/common';
import { DomainException } from '../exception/domain.exception';
import { ConfigService } from '@nestjs/config';
import { Bucket, Storage } from '@google-cloud/storage';
import { extname } from 'path';
import { v4 as uuid } from 'uuid';
import { ENV_GCS_BUCKET_KEY } from '../const/env-keys.const';
import { CHATS_PREFIX, POSTS_PREFIX, TEMP_PREFIX, USERS_PREFIX } from '../const/path.const';

/**
 * 사진 파일을 Google Cloud Storage(구글의 파일 창고)에 넣고 빼는 일만 담당한다.
 *
 * 예전에는 서버 컴퓨터의 public/ 폴더에 저장했는데,
 * 배포하면 새로 배포할 때마다 그 폴더가 통째로 사라지기 때문에 창고로 옮겼다.
 *
 * 인증 정보는 코드 어디에도 없다.
 *  - 로컬  : `gcloud auth application-default login` 으로 만든 자격증명을 라이브러리가 알아서 찾는다
 *  - 배포후 : Cloud Run이 서비스 계정을 자동으로 붙여준다
 */
@Injectable()
export class StorageService {
    private readonly logger = new Logger(StorageService.name);
    private readonly bucket: Bucket;
    private readonly bucketName: string;

    constructor(private readonly configService: ConfigService) {
        this.bucketName = this.configService.get<string>(ENV_GCS_BUCKET_KEY) ?? '';

        if (!this.bucketName) {
            throw new Error('GCS_BUCKET 환경변수가 설정되지 않았습니다. .env를 확인하세요.');
        }

        this.bucket = new Storage().bucket(this.bucketName);
    }

    /**
     * 임시 폴더(temp/)에 사진을 올린다.
     * 아직 가입이 확정되지 않은 상태의 사진이라 여기 둔다.
     *
     * temp/ 안의 파일은 GCS 수명주기 규칙이 1일 뒤 자동으로 지운다.
     * (예전에는 이걸 직접 Cron으로 청소했지만 이제 창고가 알아서 한다)
     *
     * @returns 창고 안에서의 파일 경로. 예) temp/3f9a-1b2c.png
     */
    async uploadToTemp(file: Express.Multer.File): Promise<string> {
        // 원래 파일명을 그대로 쓰면 다른 사람 파일과 겹치거나
        // 파일명으로 개인정보가 새어나갈 수 있어 무작위 이름으로 바꾼다.
        const objectName = `${TEMP_PREFIX}${uuid()}${extname(file.originalname)}`;

        try {
            await this.bucket.file(objectName).save(file.buffer, {
                contentType: file.mimetype,
                resumable: false,
            });
        } catch (e) {
            this.logger.error(`이미지 업로드 실패: ${objectName}`, e as Error);
            throw new DomainException('IMAGE_UPLOAD_FAILED');
        }

        return objectName;
    }

    /**
     * 임시 폴더에 있던 사진을 최종 위치로 옮긴다.
     *
     * ⚠️ 창고에는 '이동'이라는 기능이 없다. 복사한 뒤 원본을 지우는 방식으로 흉내낸다.
     *    (예전 로컬 디스크에서는 promises.rename 한 줄이면 됐다)
     *
     * @returns 옮겨진 뒤의 경로. 예) users/3f9a-1b2c.png
     */
    async moveFromTemp(
        tempObjectName: string,
        target: 'users' | 'posts' | 'chats',
    ): Promise<string> {
        // 'chats' 는 Phase 6(이야기)에서 추가됐다.
        // if/else 사슬 대신 표로 둔 이유 — 폴더가 하나 늘 때마다 조건문이 길어지고,
        // 새 값을 빠뜨려도 컴파일이 통과해 조용히 posts/ 로 들어가버린다.
        // Record<유니온, string> 이면 값을 빠뜨렸을 때 컴파일이 막아준다.
        const prefixByTarget: Record<typeof target, string> = {
            users: USERS_PREFIX,
            posts: POSTS_PREFIX,
            chats: CHATS_PREFIX,
        };
        const prefix = prefixByTarget[target];
        // temp/3f9a.png → 3f9a.png 만 떼어내서 새 폴더에 붙인다
        const fileName = tempObjectName.replace(TEMP_PREFIX, '');
        const destName = `${prefix}${fileName}`;

        try {
            await this.bucket.file(tempObjectName).copy(this.bucket.file(destName));
            await this.bucket.file(tempObjectName).delete({ ignoreNotFound: true });
        } catch (e) {
            this.logger.error(`이미지 이동 실패: ${tempObjectName} → ${destName}`, e as Error);
            throw new DomainException('IMAGE_UPLOAD_FAILED');
        }

        return destName;
    }

    /**
     * 창고에서 파일을 지운다.
     * 이미 없는 파일이어도 에러를 내지 않는다(ignoreNotFound).
     * 화면에서는 이미 지워진 상태이므로 여기서 막히면 안 되기 때문이다.
     */
    async delete(objectName: string): Promise<void> {
        try {
            await this.bucket.file(objectName).delete({ ignoreNotFound: true });
        } catch (e) {
            // 파일 삭제 실패가 전체 흐름을 막으면 안 된다. 기록만 남긴다.
            this.logger.warn(`이미지 삭제 실패(무시하고 진행): ${objectName} - ${e}`);
        }
    }

    /** 창고에 파일이 실제로 있는지 확인 (검증용) */
    async exists(objectName: string): Promise<boolean> {
        const [found] = await this.bucket.file(objectName).exists();
        return found;
    }

    /**
     * 앱에서 바로 열 수 있는 전체 주소를 만든다.
     * 버킷이 '누구나 읽기 가능'으로 설정돼 있어서 이 주소만 있으면 사진이 보인다.
     */
    publicUrl(objectName: string): string {
        return `https://storage.googleapis.com/${this.bucketName}/${objectName}`;
    }
}
