import { Controller, Get, Logger } from '@nestjs/common';
import { AppService } from './app.service';

@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}
  private readonly logger = new Logger('PING-CHECK');

  @Get()
  getHello(): string {
    return this.appService.getHello();
  }

  // 서버 테스트용 
  // @Get('ping')
  // getHello(): string {
  //   // 1. 서버 터미널에 로그가 찍히는지 확인
  //   this.logger.log('🚀 플러터에서 신호가 왔습니다!'); 
  //   return 'pong';
  // }
}
