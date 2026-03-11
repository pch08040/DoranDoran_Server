import { Module } from '@nestjs/common';
import { CommonService } from './common.service';
import { CommonController } from './common.controller';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports:[
    // TypeOrmModule.forFeature([PostImageModel])
  ],
  controllers: [CommonController],
  providers: [CommonService],

  exports: [CommonService],
})
export class CommonModule {}
