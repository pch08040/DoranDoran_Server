import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
  // app.useStaticAssets 사용을 위해 Express용 기능 부여
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.useGlobalPipes(new ValidationPipe({
    transform: true,
    transformOptions:{
      // 이걸 사용하면 @Type(()=> Number) 다시 안쓰고 @IsNumber()이 데코레이션을 인식해서 자동으로 타입 바꿔줌
      enableImplicitConversion: true
    },
    // dto등에 정의되어 있지 않는 데이터가 전달되면 삭제 
    whitelist: true,
    // 정의되어 있지 않는 값이 하나라도 들어오면, 아예 400 Bad Request
    forbidNonWhitelisted: true,
  }));

  // 'public' 폴더 외부 공개
  app.useStaticAssets(join(__dirname, '..', 'public'));
  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
