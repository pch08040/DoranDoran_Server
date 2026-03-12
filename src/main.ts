import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { ValidationPipe } from '@nestjs/common';
import { NestExpressApplication } from '@nestjs/platform-express';
import { join } from 'path';

async function bootstrap() {
  // app.useStaticAssets 사용을 위해 Express용 기능 부여
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  app.enableCors(); // 모든 요청 허용 (테스트용)

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
  }));

  // 'public' 폴더 외부 공개
  app.useStaticAssets(join(__dirname, '..', 'public'));
  const port = await app.listen(process.env.PORT ?? 3000);
}
bootstrap();

// async function bootstrap() {
//   const app = await NestFactory.create<NestExpressApplication>(AppModule);

//   // 1. [위치 이동] CORS 설정을 listen보다 위로 올렸습니다.
//   // 이게 아래에 있으면 시뮬레이터(외부 요청)가 거절당합니다.
//   app.enableCors();

//   app.useGlobalPipes(new ValidationPipe({
//     transform: true,
//     transformOptions: {
//       enableImplicitConversion: true
//     },
//     whitelist: true,
//     forbidNonWhitelisted: true,
//   }));

//   // 'public' 폴더 외부 공개
//   app.useStaticAssets(join(__dirname, '..', 'public'));

//   // 2. [수정] 포트 번호 뒤에 '0.0.0.0'을 붙여서 로컬 네트워크 접속을 확실히 허용합니다.
//   const port = process.env.PORT ?? 3000;
//   await app.listen(port, '0.0.0.0');

//   console.log(`🚀 서버가 http://localhost:${port} 에서 돌아가는 중입니다!`);
// }

// // 3. [유지] 이 함수를 호출해야 앱이 켜집니다!
// bootstrap();
