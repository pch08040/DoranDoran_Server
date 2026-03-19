import { Controller, Delete, Param, ParseIntPipe, Post, UploadedFile, UseInterceptors } from '@nestjs/common';
import { CommonService } from './common.service';
import { FileInterceptor } from '@nestjs/platform-express';
import { IsPublic } from './decorator/is-public.decorator';
import { User } from 'src/users/decorator/user.decorator';
import { UsersModel } from 'src/users/entities/users.entity';

@Controller('common')
export class CommonController {
  constructor(private readonly commonService: CommonService) { }

  @Post('image')
  @UseInterceptors(FileInterceptor('image'))
  async seletedImage(
    @UploadedFile() file: Express.Multer.File,
    @User() user : UsersModel,
  ) {
    return await this.commonService.createTemporaryImage(file, user.id);
  }

  @Delete('image/:id')
  deleteImage(
    @User() user: UsersModel,
    @Param('id', ParseIntPipe) imageId: number,
    // @Param('fileName') fileName: string
  ){
    return this.commonService.deleteImageById(imageId, user.id);
  }
}