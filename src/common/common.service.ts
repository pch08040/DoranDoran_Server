import { BadRequestException, Injectable } from '@nestjs/common';
import { DomainException } from './exception/domain.exception';
import { BasePaginationDto } from './dto/base-pagination.dto';
import { FindManyOptions, FindOptionsOrder, FindOptionsWhere, Repository } from 'typeorm';
import { BaseModel } from './entity/base.entity';
import { FILTER_MAPPER } from './const/filter-mapper.const';
import { ConfigService } from '@nestjs/config';
import { ENV_HOST_KEY, ENV_PORT_KEY, ENV_PROTOCOL_KEY } from './const/env-keys.const';
import { ImageModel, ImageModelType } from './entity/image.entity';
import { DEFAULT_PROFILE_OBJECT } from './const/path.const';
import { InjectRepository } from '@nestjs/typeorm';
import { StorageService } from './storage/storage.service';

@Injectable()
export class CommonService {
    constructor(
        @InjectRepository(ImageModel)
        private readonly imageRepository: Repository<ImageModel>,
        private readonly configService: ConfigService,
        // 실제 파일을 창고(GCS)에 넣고 빼는 일을 담당
        private readonly storageService: StorageService,
    ) { }

    // <페이징 기능 공통 로직>
    // BaseModel을 상속한 모델을 원합니다!
    paginate<T extends BaseModel>(
        // 페이징 구현을 위한 기본 변수
        dto: BasePaginationDto,
        // 데이터를 어디서(어느 테이블에서) 꺼내올 것인가?(각 모델의 Repository를 전달)
        repository: Repository<T>,
        // 데이터를 가져올 때 추가로 적용할 필터나 조건
        overrideFindOptions: FindManyOptions<T> = {},
        // 다음 페이지 주소(URL)를 만들 때 사용할 경로 이름
        path: string,
    ) {
        return this.cursorPaginate(
            dto,
            repository,
            overrideFindOptions,
            path,
        )
    }
    private async cursorPaginate<T extends BaseModel>(
        dto: BasePaginationDto,
        repository: Repository<T>,
        overrideFindOptions: FindManyOptions<T> = {},
        path: string,
    ) {
        const findOptions = this.composeFindOptions<T>(dto);

        const results = await repository.find({
            ...findOptions,
            ...overrideFindOptions,
        });

        const lastItem = results.length > 0 && results.length === dto.take ? results[results.length - 1] : null;

        // .env값 가져오기
        const protocol = this.configService.get<string>(ENV_PROTOCOL_KEY);
        const host = this.configService.get<string>(ENV_HOST_KEY);
        const port = this.configService.get<string>(ENV_PORT_KEY);

        // 마지막 데이터가 존재하면 URL객체 생성
        const nextUrl = lastItem && new URL(`${protocol}://${host}:${port}/${path}`);

        if (nextUrl) {
            /**
             * dto의 키값들을 루핑하면서
             * 키값에 해당되는 벨류가 존재하면
             * param에 그대로 붙여넣는다.
             * 
             * 단, where__id_more_than 값만 lastItem의 마지막 값으로 넣어준다.
             */
            for (const key of Object.keys(dto)) {
                if (dto[key]) {
                    if (key !== 'where__id__more_than' && key !== 'where__id__less_than') {
                        nextUrl.searchParams.append(key, dto[key]);
                    }
                }
            }
            let key = '';

            if (dto.order__createdAt === 'ASC') {
                key = 'where__id__more_than';
            } else {
                key = 'where__id__less_than';
            }

            nextUrl.searchParams.append(key, lastItem.id.toString());
        }

        /**
        * Response
        * 
        * data: Data[],
        * cursor: {
        *  after: 마지막 Data의 ID
        * },
        * count: 응답한 데이터의 갯수
        * next: 다음 요청을 할때 사용할 URL
        */

        return {
            data: results,
            cursor: {
                after: lastItem?.id ?? null
            },
            count: results.length,
            next: nextUrl?.toString() ?? null,
        }
    }

    // 옵션을 찾아서 조립하다(?)
    private composeFindOptions<T extends BaseModel>(
        dto: BasePaginationDto,
    ): FindManyOptions<T> {
        /**
         * where,
         * order,
         * take,
         * skip -> page 기반일때만
         */

        /**
         * DTO의 현재 생긴 구조는 아래와 같다
         * 
         * {
         *  where__id__more_than: 1,
         *  order__createdAt: 'ASC'
         * }
         * 
         * 현재는 where__id__more_than / where__id__less_than에 해당되는 where 필터만 사용중이지만
         * 나중에 where__likeCount__more_than 이나 where__title__ilike 등 추가 필터를 넣고싶어졌을때
         * 모든 where 필터들을 자동으로 파싱 할 수 있을만한 기능을 제작해야한다.
         * 
         * 1) where로 시작한다면 필터 로직을 적용한다.
         * 2) order로 시작한다면 정렬 로직을 적용한다.
         * 3) 필터 로직을 적용한다면 '__' 기준으로 split 했을때 3개의 값으로 나뉘는지
         *    2개의 값으로 나뉘는지 확인한다.
         *    3-1) 3개의 값으로 나뉜다면 FILTER_MAPPER에서 해당되는 operator 함수를 찾아서 적용한다.
         *         ['where', 'id', 'more_than']
         *    3-2) 2개의 값으로 나뉜다면 정확한 값을 필터하는 것이기 때문에 operator 없이 적용한다.
         *         where__id
         *         ['where', 'id']
         * 4) order의 경우 3-2와 같이 적용한다.
         */

        let where: FindOptionsWhere<T> = {};
        let order: FindOptionsOrder<T> = {};

        for (const [key, value] of Object.entries(dto)) {
            // key -> where__id__less_than
            // value -> 1

            // content 같은 key의 값이 존재하지 않아도 조립해라! 
            if (value === undefined || value === null) {
                continue;
            }

            if (key.startsWith('where__')) {
                where = {
                    ...where,
                    ...this.parseWhereFilter(key, value),
                }
            } else if (key.startsWith('order__')) {
                order = {
                    ...order,
                    ...this.parseOrderFilter(key, value),
                }
            }
        }

        return {
            where,
            order,
            take: dto.take,
        };
    }

    private parseWhereFilter<T extends BaseModel>(key: string, value: any):
        FindOptionsWhere<T> | FindOptionsOrder<T> {

        const options: FindOptionsWhere<T> = {};

        const split = key.split('__');

        if (split.length !== 2 && split.length !== 3) {
            throw new BadRequestException(
                `where 필터는 '__'로 split 했을때 길이가 2 또는 3이어야합니다 - 문제되는 키값 : ${key}`,
            )
        }

        if (split.length === 2) {
            // ['where', 'id']
            // ['order', 'createdAt']
            const [_, field] = split;

            /**
             * field -> 'id'
             * value -> 3
             * 
             * {
             *      id: 3,
             * }
             */
            options[field] = value;
        } else {
            /**
             * 길이가 3일 경우에는 Typeorm 유틸리티 적용이 필요한 경우다.
             * 
             * where__id__more_than의 경우
             * where는 버려도 되고 두번째 값은 필터할 키값이 되고
             * 세번째 값은 typeorm 유틸리티가 된다.
             * 
             * FILTER_MAPPER에 미리 정의해둔 값들로
             * field 값에 FILTER_MAPPER에서 해당되는 utility를 가져온 후
             * 값에 적용 해준다.
             */

            // ['where', 'id', 'more_than']
            const [_, field, operator] = split;

            // where__id__between = 3,4
            // 만약에 split 대상 문자가 존재하지 않으면 길이가 무조건 1이다.
            // const values = value.toString().split(',')

            // field -> id
            // operator -> more_than
            // FILTER_MAPPER[operator] -> MoreThan
            // if(operator === 'between'){
            //     options[field] = FILTER_MAPPER[operator](values[0], values[1]);
            // }else{
            //     options[field] = FILTER_MAPPER[operator](value);
            // }

            if (operator === 'i_like') {
                options[field] = FILTER_MAPPER[operator](`%${value}%`)
            } else {
                options[field] = FILTER_MAPPER[operator](value);
            }
        }

        return options;
    }

    private parseOrderFilter<T extends BaseModel>(key: string, value: any)
        : FindOptionsOrder<T> {

        const order: FindOptionsOrder<T> = {};

        /**
         * order는 무조건 두개로 스플릿된다.
         */
        const split = key.split('__');

        if (split.length !== 2) {
            throw new BadRequestException(
                `order 필터는 '__'로 split 했을때 길이가 2여야합니다. - 문제되는 키값: ${key}`,
            )
        }

        const [_, field] = split;

        order[field] = value;

        return order;
    }


    // ─────────────────────────────────────────────────────────────
    // 이미지 관련 로직
    //
    // 예전에는 서버 컴퓨터의 public/ 폴더에 파일을 직접 읽고 쓰고 지웠다.
    // 이제는 StorageService를 통해 Google Cloud Storage(구글 파일 창고)를 다룬다.
    // 이 클래스는 'DB 기록'을, StorageService는 '실제 파일'을 담당한다.
    // ─────────────────────────────────────────────────────────────

    /**
     * 임시 사진을 창고에 올리고 DB에 기록한다.
     * 사용자가 프로필 설정 화면에서 사진을 고르는 즉시 호출된다.
     * (아직 가입 완료 전이라 temp/ 폴더에 둔다)
     */
    async createTemporaryImage(file: Express.Multer.File, userId: number) {
        // 1. 창고의 temp/ 폴더에 업로드 → temp/3f9a-1b2c.png 같은 경로를 돌려받는다
        const objectName = await this.storageService.uploadToTemp(file);

        // 2. DB에 기록
        const newImage = await this.imageRepository.save({
            path: objectName,
            type: ImageModelType.TEMP_IMAGE,
            user: { id: userId },
        });

        return {
            id: newImage.id,
            fileName: objectName,
        };
    }

    /**
     * 임시 사진을 최종 위치(users/ 또는 posts/)로 옮기고 DB에 기록한다.
     * 가입 완료 버튼을 누르는 시점에 호출된다.
     */
    async createImages(dto: {
        fileName: string;
        type: ImageModelType;
        order: number;
        userId?: number;
        postId?: number;
    }) {
        const target = dto.type === ImageModelType.USER_IMAGE ? 'users' : 'posts';

        // 창고에는 '이동'이 없어서 복사 후 원본 삭제로 처리된다 (StorageService 안에서)
        const objectName = await this.storageService.moveFromTemp(dto.fileName, target);

        // 방금 옮긴 파일의 옛 임시 기록이 DB에 남아있다면 정리한다
        await this.imageRepository.delete({ path: dto.fileName });

        return await this.imageRepository.save({
            path: objectName,   // 창고 경로 (users/3f9a-1b2c.png)
            type: dto.type,
            order: dto.order,   // 프로필 사진 순서 (0, 1, 2)
            // id만 담긴 객체를 넘기면 TypeORM이 알아서 외래키를 맺어준다
            user: dto.userId ? { id: dto.userId } : undefined,
            post: dto.postId ? { id: dto.postId } : undefined,
        });
    }

    /**
     * 특정 사용자의 '확정된' 프로필 사진을 전부 지운다.
     * 프로필 사진을 새로 등록할 때 기존 것을 정리하는 용도다.
     *
     * ⚠️ 임시 사진(TEMP_IMAGE)은 절대 건드리면 안 된다.
     *    가입 완료 처리는 [기존 사진 삭제 → 임시 사진을 최종 위치로 이동] 순서로 도는데,
     *    여기서 임시 사진까지 지워버리면 바로 다음 단계에서 옮길 파일이 사라진다.
     *    (로컬 디스크를 쓰던 시절엔 임시 파일이 다른 폴더에 있어서 우연히 안 걸렸다)
     */
    async delteUserImages(userId: number) {
        const images = await this.imageRepository.find({
            where: {
                user: { id: userId },
                type: ImageModelType.USER_IMAGE,
            },
        });

        // 창고에서 실제 파일 삭제
        for (const image of images) {
            // 기본 프로필은 모든 사용자가 공유하는 파일이라 절대 지우면 안 된다
            if (image.path === DEFAULT_PROFILE_OBJECT) continue;

            await this.storageService.delete(image.path);
        }

        // DB 기록 삭제 (임시 사진 기록은 남겨둔다)
        await this.imageRepository.delete({
            user: { id: userId },
            type: ImageModelType.USER_IMAGE,
        });
    }

    /** 사진 한 장을 지운다 (프로필 설정 화면에서 '사진 삭제'를 누를 때) */
    async deleteImageById(imageId: number, userId: number) {
        const image = await this.imageRepository.findOne({
            where: { id: imageId },
            relations: ['user'],
        });

        if (!image) {
            throw new DomainException('IMAGE_NOT_FOUND');
        }

        // 남의 사진을 지우지 못하게 막는다
        if (image.user && image.user.id !== userId) {
            throw new DomainException('IMAGE_FORBIDDEN');
        }

        if (image.path !== DEFAULT_PROFILE_OBJECT) {
            await this.storageService.delete(image.path);
        }

        await this.imageRepository.delete(imageId);

        return imageId;
    }

    // ⚠️ 예전에 있던 cleanTempFolder() Cron은 삭제했다.
    //    창고(GCS)의 수명주기 규칙이 temp/ 안의 1일 지난 파일을 자동으로 지워준다.
    //    우리가 관리할 코드가 하나 줄었다.
}
