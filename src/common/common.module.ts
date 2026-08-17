import { BadRequestException, Module } from '@nestjs/common';
import { CommonService } from './common.service';
import { CommonController } from './common.controller';
import { MulterModule } from '@nestjs/platform-express';
import { extname } from 'path';
import * as multer from 'multer';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ImageModel } from './entity/image.entity';
import { StorageService } from './storage/storage.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([ImageModel]),
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

        if (ext !== '.jpg' && ext !== '.jpeg' && ext !== '.png') {
          return cb(
            new BadRequestException('jpg/jpeg/png 파일만 업로드 가능합니다!'),
            // 파일 다운로드 안함
            false,
          );
        }

        return cb(null, true);
      },

      /**
       * 예전에는 diskStorage를 써서 서버 컴퓨터의 public/temp 폴더에 파일을 바로 저장했다.
       * 이제는 파일을 창고(GCS)로 보내야 하므로, 디스크에 쓰지 않고
       * 메모리에 잠깐 들고 있다가 StorageService가 창고로 전달한다.
       *
       * (파일명 짓기도 StorageService가 담당한다)
       */
      storage: multer.memoryStorage(),
    }),
  ],
  controllers: [CommonController],
  providers: [CommonService, StorageService],

  exports: [CommonService, StorageService],
})
export class CommonModule { }
