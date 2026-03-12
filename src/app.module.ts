import { ClassSerializerInterceptor, Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { UsersModule } from './users/users.module';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from './auth/auth.module';
import { CommonModule } from './common/common.module';
import { ConfigModule } from '@nestjs/config';
import { ENV_DB_DATABASE_KEY, ENV_DB_HOST_KEY, ENV_DB_PASSWORD_KEY, ENV_DB_PORT_KEY, ENV_DB_USERNAME_KEY, ENV_HOST_KEY } from './common/const/env-keys.const';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { PostsModule } from './posts/posts.module';
import { CacheModule } from '@nestjs/cache-manager';
import { redisStore } from 'cache-manager-redis-yet';
import { AccessTokenGuard } from './auth/guard/bearer-token.guard';
// 서버에게 특정 폴더를 "있는 그대로 보여주는 창고"라고 지정
import { ServeStaticModule } from '@nestjs/serve-static';
import { PUBLIC_FOLDER_PATH } from './common/const/path.const';
import { ScheduleModule } from '@nestjs/schedule';


@Module({
  imports: [
    // 오래된 임시 이미지 자동 삭제
    ScheduleModule.forRoot(),
    ServeStaticModule.forRoot({
      // 1. rootPath: 실제 사진이 들어있는 '컴퓨터상의 물리적 주소'
      rootPath: PUBLIC_FOLDER_PATH,
      // 2. serveRoot: 유저가 브라우저나 플러터에서 접근할 때 사용하는 '가상 주소'
      // 그냥 앞에 /public 이라고 붙여서 들어오는 요청은 저 폴더에서 찾아준다는 약속
      serveRoot: '/public',
    }),
    ConfigModule.forRoot({
      envFilePath: '.env', // 읽어올 파일 경로
      isGlobal: true, // 프로젝트 전체에서 환경변수 사용 가능하게 설정
    }),
    CacheModule.registerAsync({
      isGlobal: true,
      useFactory: async () => ({
        store: await redisStore({
          socket: {
            host: 'localhost',
            port: 6379,
          },
          ttl: 300000,
        })
      }),
    }),
    UsersModule,
    AuthModule,
    CommonModule,
    PostsModule,
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env[ENV_DB_HOST_KEY],
      port: parseInt(process.env[ENV_DB_PORT_KEY] || '5432'),
      username: process.env[ENV_DB_USERNAME_KEY],
      password: process.env[ENV_DB_PASSWORD_KEY],
      database: process.env[ENV_DB_DATABASE_KEY],
      autoLoadEntities: true,
      entities: [],
      synchronize: true, // 엔티티와 DB 테이블 자동 동기화(테스트 환경에서만 사용 권장)
    }),
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
