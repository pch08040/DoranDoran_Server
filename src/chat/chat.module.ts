import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from 'src/auth/auth.module';
import { CommonModule } from 'src/common/common.module';
import { ModerationModule } from 'src/moderation/moderation.module';
import { UsersModule } from 'src/users/users.module';
import { UsersModel } from 'src/users/entities/users.entity';
import { ChatController } from './chat.controller';
import { ChatGateway } from './chat.gateway';
import { ChatService } from './chat.service';
import { ChatMessageModel } from './entities/chat-message.entity';
import { ChatRoomMemberModel } from './entities/chat-room-member.entity';
import { ChatRoomModel } from './entities/chat-room.entity';

/**
 * 이야기(채팅) 모듈. (Phase 6)
 *
 * AuthModule / UsersModule 을 들여오는 이유
 *   소켓 연결에는 가드가 안 붙는다. 게이트웨이가 **직접** 토큰을 확인해야 해서
 *   AuthService(토큰 검증)와 UsersService(전화번호로 유저 찾기)가 필요하다.
 */
@Module({
    imports: [
        TypeOrmModule.forFeature([
            ChatRoomModel,
            ChatRoomMemberModel,
            ChatMessageModel,
            // 상대방 프로필(이름·사진)을 같이 내려주기 위해 필요하다.
            UsersModel,
        ]),
        AuthModule,
        UsersModule,
        ModerationModule,
        // StorageService (사진을 temp/ 에서 chats/ 로 옮기는 일)
        CommonModule,
    ],
    controllers: [ChatController],
    providers: [ChatService, ChatGateway],
})
export class ChatModule { }
