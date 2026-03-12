import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { BasePaginationDto } from './dto/base-pagination.dto';
import { FindManyOptions, FindOptionsOrder, FindOptionsWhere, Repository } from 'typeorm';
import { BaseModel } from './entity/base.entity';
import { FILTER_MAPPER } from './const/filter-mapper.const';
import { ConfigService } from '@nestjs/config';
import { ENV_HOST_KEY, ENV_PORT_KEY, ENV_PROTOCOL_KEY } from './const/env-keys.const';
import { ImageModel, ImageModelType } from './entity/image.entity';
import { POST_IMAGE_PATH, PUBLIC_FOLDER_PATH, TEMP_FOLDER_PATH, USERS_IMAGE_PATH } from './const/path.const';
import { existsSync, promises, renameSync } from 'fs';
import { basename, join } from 'path';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron, CronExpression } from '@nestjs/schedule';

@Injectable()
export class CommonService {
    constructor(
        @InjectRepository(ImageModel)
        private readonly imageRepository: Repository<ImageModel>,
        private readonly configService: ConfigService,
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

        // 🔍 여기를 확인하세요!
        console.log('Final Where:', findOptions.where); // 👈 이게 { id: LessThan(20) } 인지 확인!
        console.log('Final Order:', findOptions.order); // 👈 이게 { createdAt: 'ASC' } 인지 확인!

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


    // <이미지 업로드 로직>
    async createImages(dto: {
        fileName: string;
        type: ImageModelType;
        order: number;
        userId?: number;
        postId?: number;
    }) {
        // 1. 이미지가 저장될 실제 경로를 결정(유저용 or 포스트용)
        // /{프로젝트의 위치}/public/users
        const realPath = dto.type === ImageModelType.USER_IMAGE
            ? USERS_IMAGE_PATH : POST_IMAGE_PATH;

        // 2. 파일을 옮기는 로직 (temp => 실제 저장 폴더)
        // await this.moveFile(dto.fileName, targetPath);

        // 현재 이미지 파일 위치
        const tempFilePath = join(TEMP_FOLDER_PATH, dto.fileName);

        try {
            await promises.access(tempFilePath);
        } catch (e) {
            throw new BadRequestException('존재하지 않는 파일 입니다.');
        }

        // 파일이 새로 갈 곳
        const destPath = join(realPath, dto.fileName);

        try {
            await promises.rename(tempFilePath, destPath);
        } catch (e) {
            throw new InternalServerErrorException('파일 이동 중 에러가 발생했습니다.');
        }

        // renameSync(tempFilePath, destPath);

        return await this.imageRepository.save({
            path: dto.fileName, // 파일명 (uuid.png)
            type: dto.type,     // 이미지 타입 (USER_IMAGE 등)
            order: dto.order,   // 순서 (0, 1, 2)
            // 관계 설정: id만 담긴 객체를 넘겨주면 TypeORM이 알아서 외래키를 맺어줘.
            user: dto.userId ? { id: dto.userId } : undefined,
            post: dto.postId ? { id: dto.postId } : undefined,
        })
    }

    // 이미지 전체삭제 함수
    async delteUserImages(userId: number) {
        // 1. 해당 유저가 가진 모든 이미지를 DB에서 먼저 찾아옵니다.
        const images = await this.imageRepository.find({
            where: { user: { id: userId } },
        });

        // 2. 루프를 돌며 실제 파일 시스템에서 삭제합니다.
        for (const image of images) {
            // 기본 이미지는 파일 자체를 지우면 안 되므로 체크가 필요할 수 있음
            if (image.path !== 'basicProfile.png') {
                const filePath = join(USERS_IMAGE_PATH, image.path);
                if (existsSync(filePath)) {
                    await promises.unlink(filePath);
                }
            }
        }

        await this.imageRepository.delete({ user: { id: userId } });
    }

    async deleteImageById(imageId: number){
        // 1. DB에서 해당 이미지 정보를 가져옵니다.
        const image = await this.imageRepository.findOne({
            where: {id: imageId}
        });

        if(!image){
            throw new BadRequestException('존재하지 않는 이미지입니다.');
        }

        // 2. 파일 경로 설정 (타입에 따라 분기)
        const rootPath = image.type === ImageModelType.USER_IMAGE
        ? USERS_IMAGE_PATH : POST_IMAGE_PATH;

        const filePath = join(rootPath, image.path);

        // 3. 실제 파일 삭제(기본 프로필이 아닐 때만)
        if(image.path !== 'basicProfile.png'){
            try{
                if(existsSync(filePath)){
                    await promises.unlink(filePath);
                }
            }catch(e){
                // 파일이 이미 없거나 삭제 실패해도 로그만 남기고 진행(DB 적합성이 더 중요)
                console.log(`파일 삭제 실패 : ${filePath}`, e);
            }
        }

        await this.imageRepository.delete(imageId);

        return imageId;
    }

    // 오래된 이미지 파일 삭제
    @Cron(CronExpression.EVERY_DAY_AT_MIDNIGHT)
    async cleanTempFolder() {
        console.log('-- 임시 폴더 청소 시작--');

        const files = await promises.readdir(TEMP_FOLDER_PATH);
        const now = Date.now();

        for (const file of files) {
            const filePath = join(TEMP_FOLDER_PATH, file);
            const stats = await promises.stat(filePath);

            // 생성된 지 12시간이 지난 파일만 골라서 삭제
            const hours12InMs = 12 * 60 * 60 * 1000;
            if (now - stats.mtimeMs > hours12InMs) {
                await promises.unlink(filePath);
                console.log(`삭제된 파일: ${file}`);
            }
        }
    }
}
