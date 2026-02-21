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
import { UsersModel } from './users/entities/users.entity';
import { PostsModel } from './posts/entity/posts.entity';


@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: '.env', // 읽어올 파일 경로
      isGlobal: true, // 프로젝트 전체에서 환경변수 사용 가능하게 설정
    }),
    // RedisModule.forRoot({
    //   type: 'single',
    //   url: 'redis://localhost:6379',
    // }),
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
      synchronize: true, // 엔티티와 DB 테이블 자동 동기화
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
