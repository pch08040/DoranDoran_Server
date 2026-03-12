import { Controller, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { CommonService } from './common.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { IsPublic } from './decorator/is-public.decorator';

@Controller('common')
export class CommonController {
  constructor(private readonly commonService: CommonService) { }

  @Post('image')
  @UseInterceptors(FileInterceptor('image'))
  seletedImage(
    @UploadedFile() file: Express.Multer.File,
  ) {
    return {
      fileName: file.filename,
    }
  }
}
