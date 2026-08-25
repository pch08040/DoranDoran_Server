import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ModerationService } from './moderation.service';
import { ModerationController, ReportReasonsController } from './moderation.controller';
import { UserReportModel } from './entities/user-report.entity';
import { UserBlockModel } from './entities/user-block.entity';

@Module({
  imports: [TypeOrmModule.forFeature([UserReportModel, UserBlockModel])],
  controllers: [ReportReasonsController, ModerationController],
  providers: [ModerationService],
  // 친구 목록에서 차단된 사람을 걸러내야 하므로 UsersModule 이 가져다 쓴다.
  exports: [ModerationService],
})
export class ModerationModule { }
