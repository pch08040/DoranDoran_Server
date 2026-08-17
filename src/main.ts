import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { AllExceptionsFilter } from './common/filter/all-exceptions.filter';
import { validationExceptionFactory } from './common/pipe/validation-exception.factory';

async function bootstrap() {
  // Express 전용 기능(정적 서빙 등)을 쓰기 위해 플랫폼 타입을 지정
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableCors(); // 모든 요청 허용 (테스트용)

  /**
   * 모든 예외를 여기서 가로채 하나의 형식으로 바꿔 내보낸다.
   *   { code, message, statusCode, path }
   *
   * 앱은 code 를 보고 분기하고, 모르는 code 면 message 를 그대로 띄운다.
   * 규격 상세는 src/common/const/error-code.const.ts
   */
  app.useGlobalFilters(new AllExceptionsFilter());

  app.useGlobalPipes(new ValidationPipe({
    // DTO의 타입을 자동으로 변환 (String => Number 등)
    transform: true,
    transformOptions:{
      // 이걸 사용하면 @Type(()=> Number) 다시 안쓰고 @IsNumber()이 데코레이션을 인식해서 자동으로 타입 바꿔줌
      enableImplicitConversion: true
    },
    // dto등에 정의되어 있지 않는 데이터가 전달되면 삭제 
    whitelist: true,
    // 정의되어 있지 않는 값이 하나라도 들어오면, 아예 400 Bad Request
    forbidNonWhitelisted: true,

    /**
     * 검증 실패를 어떤 예외로 바꿀지 우리가 정한다.
     *
     * 기본 동작은 실패 문구를 그대로 message 배열에 담아 내보내는데,
     * 그 안에는 "property xxx should not exist" 같은 영어 개발자 문구가 섞여 있다.
     * 사용자에게 보여도 되는 것만 골라내기 위해 갈아끼운다.
     */
    exceptionFactory: validationExceptionFactory,
  }));

  /**
   * ⚠️ 여기서 app.useStaticAssets(...)를 prefix 없이 부르면 안 된다.
   *    static 미들웨어는 라우터보다 먼저 실행되기 때문에
   *    public/users, public/posts 폴더가 GET /users, GET /posts API를 통째로 가로챈다.
   *    (사진은 Cloud Storage에 있으므로 서버가 파일을 내보낼 일 자체가 없다)
   *
   * PORT는 배포 플랫폼이 직접 주입한다. 그래서 고정값으로 두면 안 된다.
   */
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
