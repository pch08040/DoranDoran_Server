import { ClassSerializerInterceptor, Logger, Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { CommonModule } from './common/common.module';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ENV_REDIS_HOST_KEY, ENV_REDIS_PORT_KEY } from './common/const/env-keys.const';
import { typeOrmModuleOptions } from './config/typeorm.config';
import { validateEnv } from './config/env.validation';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { PostsModule } from './posts/posts.module';
import { ModerationModule } from './moderation/moderation.module';
import { CacheModule } from '@nestjs/cache-manager';
import { createKeyv } from '@keyv/redis';
import { AccessTokenGuard } from './auth/guard/bearer-token.guard';
import { ScheduleModule } from '@nestjs/schedule';


@Module({
  imports: [
    // 예약 작업(@Cron)을 쓰기 위한 설정.
    // 지금은 사용하는 곳이 없지만(임시 이미지 청소는 GCS 수명주기 규칙으로 대체됨)
    // 앞으로 '게시글 2일 뒤 자동 삭제' 같은 기능에서 쓰게 된다.
    ScheduleModule.forRoot(),

    ConfigModule.forRoot({
      envFilePath: '.env', // 읽어올 파일 경로
      isGlobal: true, // 프로젝트 전체에서 환경변수 사용 가능하게 설정

      // 서버가 켜지는 순간 .env를 검사한다.
      // 빠지거나 형식이 틀린 값이 있으면 여기서 서버 기동이 중단된다.
      // (값이 없는 채로 일단 뜨고 나중에 엉뚱한 곳에서 터지는 걸 막기 위함)
      validate: validateEnv,
    }),
    /**
     * 캐시(임시 저장소) 설정. 현재 용도는 '전화번호 인증번호 3분 보관' 하나다.
     *
     * ⚠️ 옵션 이름은 반드시 `stores`(복수)여야 한다.
     *    @nestjs/cache-manager v3는 `stores`만 읽고, 없으면 아무 말 없이
     *    서버 메모리 캐시로 넘어간다. 예전 코드는 `store`(단수)를 넘기고 있어서
     *    Redis가 떠 있는데도 실제로는 전혀 쓰이지 않고 있었다.
     *    (서버를 여러 대로 늘리면 A서버가 저장한 인증번호를 B서버가 못 찾는 문제가 된다)
     */
    CacheModule.registerAsync({
      isGlobal: true,
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => {
        const host = configService.get<string>(ENV_REDIS_HOST_KEY) ?? 'localhost';
        const port = configService.get<string>(ENV_REDIS_PORT_KEY) ?? '6379';

        const redis = createKeyv(`redis://${host}:${port}`);

        // 접속이 끊겨도 서버가 통째로 죽지 않도록 에러를 받아준다.
        redis.on('error', (e) =>
          new Logger('CacheModule').error(`Redis 연결 오류: ${e}`),
        );

        return { stores: [redis] };
      },
    }),
    AuthModule,
    CommonModule,
    ModerationModule,
    UsersModule,
    PostsModule,
    // DB 설정은 src/config/typeorm.config.ts 한 곳에서 관리한다.
    // 마이그레이션 CLI도 같은 파일을 쓰므로 앱과 CLI의 설정이 어긋날 일이 없다.
    // (synchronize는 그 파일에서 false로 고정되어 있다)
    TypeOrmModule.forRoot(typeOrmModuleOptions),
  ],
  controllers: [AppController],
  providers: [AppService,
    {
      provide: APP_GUARD,
      useClass: AccessTokenGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: ClassSerializerInterceptor,
    }
  ],
})
export class AppModule { }
