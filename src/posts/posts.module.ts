import { Module } from '@nestjs/common';
import { PostsService } from './posts.service';
import { PostsController } from './posts.controller';
import { PostsModel } from './entity/posts.entity';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CommonModule } from 'src/common/common.module';
import { UsersModule } from 'src/users/users.module';
import { ModerationModule } from 'src/moderation/moderation.module';

@Module({
  imports:[
    TypeOrmModule.forFeature([PostsModel]),
    CommonModule,
    UsersModule,
    ModerationModule,
  ],
  controllers: [PostsController],
  providers: [PostsService],
})
export class PostsModule {}
