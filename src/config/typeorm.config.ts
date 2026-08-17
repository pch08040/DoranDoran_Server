import { config } from 'dotenv';
import { DataSource, DataSourceOptions } from 'typeorm';
import {
    ENV_DB_DATABASE_KEY,
    ENV_DB_HOST_KEY,
    ENV_DB_PASSWORD_KEY,
    ENV_DB_PORT_KEY,
    ENV_DB_USERNAME_KEY,
} from '../common/const/env-keys.const';

/**
 * DB 접속 설정을 한 곳에서 관리한다.
 *
 * 이 파일은 두 곳에서 쓰인다.
 *  1) NestJS 앱     — app.module.ts 의 TypeOrmModule.forRoot()
 *  2) 마이그레이션 CLI — package.json 의 migration:* 명령
 *
 * CLI는 NestJS 밖에서 단독으로 실행되기 때문에 ConfigModule의 도움을 받을 수 없다.
 * 그래서 여기서 .env를 직접 읽는다.
 */
config();

const baseOptions = {
    type: 'postgres' as const,
    host: process.env[ENV_DB_HOST_KEY],
    port: parseInt(process.env[ENV_DB_PORT_KEY] || '5432'),
    username: process.env[ENV_DB_USERNAME_KEY],
    password: process.env[ENV_DB_PASSWORD_KEY],
    database: process.env[ENV_DB_DATABASE_KEY],

    /**
     * ⚠️ synchronize는 반드시 false로 둔다.
     *
     * true로 두면 TypeORM이 엔티티(코드)를 보고 DB 테이블을 자동으로 뜯어고친다.
     * 예를 들어 컬럼 이름을 bio → introduction 으로 바꾸면
     * "bio 컬럼 삭제 + introduction 컬럼 생성"으로 처리해서
     * 그 컬럼에 들어있던 실제 사용자 데이터가 통째로 사라진다. 복구할 방법이 없다.
     *
     * 대신 마이그레이션 파일(src/migrations)에 변경 내역을 남기고,
     * 사람이 내용을 확인한 뒤 실행한다.
     */
    synchronize: false,

    // 마이그레이션 파일 위치. .ts(개발)와 .js(빌드 후) 둘 다 잡는다.
    migrations: [__dirname + '/../migrations/*{.ts,.js}'],
};

/** NestJS 앱이 사용하는 설정 */
export const typeOrmModuleOptions = {
    ...baseOptions,
    // 각 모듈에서 TypeOrmModule.forFeature()로 등록한 엔티티를 자동으로 불러온다.
    autoLoadEntities: true,
};

/** 마이그레이션 CLI가 사용하는 설정 (CLI는 자동 등록을 못 하므로 경로를 직접 알려준다) */
export const dataSourceOptions: DataSourceOptions = {
    ...baseOptions,
    entities: [__dirname + '/../**/*.entity{.ts,.js}'],
};

export default new DataSource(dataSourceOptions);
