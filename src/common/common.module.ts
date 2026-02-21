import { Module } from '@nestjs/common';
import { CommonService } from './common.service';
import { CommonController } from './common.controller';
import { ImageModel } from './entity/image.entity';
import { TypeOrmModule } from '@nestjs/typeorm';

@Module({
  imports:[
    TypeOrmModule.forFeature([ImageModel])
  ],
  controllers: [CommonController],
  providers: [CommonService],

  exports: [CommonService],
})
export class CommonModule {}
