import { BadRequestException, Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModel } from './entities/users.entity';
import { CommonModule } from 'src/common/common.module';
import { MulterModule } from '@nestjs/platform-express';
import { extname } from 'path';
import * as multer from 'multer';
import { PROFILE_IMAGE_PATH } from 'src/common/const/path.const';
import {v4 as uuid} from 'uuid';

@Module({
  imports:[
    TypeOrmModule.forFeature([UsersModel]),
    CommonModule,
    MulterModule.register({
      limits: {
        fileSize: 10000000,
      },
      fileFilter: (req, file, cb) => {
        /**
         * cb(에러, boolean)
         * 
         * 첫번째 파라미터에는 에러가 있을경우 에러 정보를 넣어준다.
         * 두번째 파라미터는 파일을 받을지 말지 boolean을 넣어준다.
         */
        const ext = extname(file.originalname);

        if(ext !== '.jpg' && ext !== '.jpeg' && ext !== '.png'){
          return cb(
            new BadRequestException('jpg/jpeg/png 파일만 업로드 가능합니다!'),
            // 파일 다운로드 안함
            false,
          );
        }
        
        return cb(null, true);
      },

      storage: multer.diskStorage({
        destination: function(req, res, cb){
          cb(null, PROFILE_IMAGE_PATH);
        },
        filename: function(req, file, cb){
          // 기존 파일이름이 아닌 uuid로 새로 만든 이름으로 저장
          // 123123-123-123123.png
          cb(null, `${uuid()}${extname(file.originalname)}`);
        }
      })
    }),
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
