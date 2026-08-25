import { BadRequestException, Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModel } from './entities/users.entity';
import { UserSettingsModel } from './entities/user-settings.entity';
import { CommonModule } from 'src/common/common.module';
import { ModerationModule } from 'src/moderation/moderation.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([UsersModel, UserSettingsModel]),
    CommonModule,
    ModerationModule,
  ],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule { }
