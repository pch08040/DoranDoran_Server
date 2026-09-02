import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    ParseIntPipe,
    Patch,
    Post,
    Query,
} from '@nestjs/common';
import { User } from 'src/users/decorator/user.decorator';
import { UsersModel } from 'src/users/entities/users.entity';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';
import { CreateRoomDto } from './dto/create-room.dto';
import { PaginateMessageDto } from './dto/paginate-message.dto';
import { UpdateFavoriteDto } from './dto/update-favorite.dto';

/**
 * 이야기(채팅)의 **실시간이 아닌** 부분. (기획서 Phase 6)
 *
 * 주소 규칙은 DEV_GUIDE 5-1절을 따른다.
 *   · 명사만 쓴다 (rooms, messages, favorite) — 동작은 메서드가 나타낸다
 *   · 케밥케이스 소문자
 *   · 응답 키는 캐멀케이스로 통일
 */
@Controller('chat')
export class ChatController {
    constructor(
        private readonly chatService: ChatService,
        private readonly chatGateway: ChatGateway,
    ) { }

    /** 이야기 목록. (시안: 이야기_홈.png) */
    @Get('rooms')
    getRooms(@User() user: UsersModel) {
        return this.chatService.getMyRooms(user.id);
    }

    /**
     * 이 사람과 이야기를 시작한다. 방이 없으면 만들고, 있으면 그 방을 준다.
     *
     * POST 인데 매번 새로 만들지 않는 게 이상해 보일 수 있다.
     * 하지만 앱 입장에서 하는 일은 언제나 "이 사람과의 방을 달라" 하나뿐이고,
     * 방이 이미 있는지는 앱이 알 필요도, 알 방법도 없다.
     */
    @Post('rooms')
    createRoom(@User() user: UsersModel, @Body() dto: CreateRoomDto) {
        return this.chatService.openRoom(user.id, dto.targetUserId);
    }

    /**
     * 대화방 한 개. 채팅방 화면이 열릴 때 상대 이름·사진과 '상대가 나갔는지'를 받는다.
     *
     * ⚠️ 이 라우트는 `rooms/:roomId/messages` 와 겹치지 않는다.
     *    `:roomId` 뒤에 아무것도 없는 주소만 여기로 온다.
     */
    @Get('rooms/:roomId')
    getRoom(
        @User() user: UsersModel,
        @Param('roomId', ParseIntPipe) roomId: number,
    ) {
        return this.chatService.getRoom(user.id, roomId);
    }

    /** 지난 대화 불러오기. (위로 밀면 이전 대화가 더 나온다) */
    @Get('rooms/:roomId/messages')
    getMessages(
        @User() user: UsersModel,
        @Param('roomId', ParseIntPipe) roomId: number,
        @Query() query: PaginateMessageDto,
    ) {
        return this.chatService.getMessages(user.id, roomId, query);
    }

    /** 즐겨찾기 켜기/끄기 */
    @Patch('rooms/:roomId/favorite')
    setFavorite(
        @User() user: UsersModel,
        @Param('roomId', ParseIntPipe) roomId: number,
        @Body() dto: UpdateFavoriteDto,
    ) {
        return this.chatService.setFavorite(user.id, roomId, dto.isFavorite);
    }

    /**
     * 대화방 나가기. (시안: 이야기_나가기.png)
     *
     * ⚠️ DELETE 지만 **방을 지우지 않는다.** 나만 빠져나올 뿐이다.
     *    진짜로 지우면 아직 남아 있는 상대의 대화 기록까지 같이 사라진다.
     */
    @Delete('rooms/:roomId')
    async leaveRoom(
        @User() user: UsersModel,
        @Param('roomId', ParseIntPipe) roomId: number,
    ) {
        const result = await this.chatService.leaveRoom(user.id, roomId);

        /**
         * 상대가 지금 그 채팅방을 보고 있을 수 있으므로 소켓으로도 알린다.
         *
         * 알리지 않으면 상대 화면은 아무 일도 없다가,
         * 메시지를 보내려는 순간에야 '상대방이 나갔어요' 오류를 만난다.
         */
        this.chatGateway.notifyRoomLeft(roomId, result.partnerId);

        return result;
    }
}
