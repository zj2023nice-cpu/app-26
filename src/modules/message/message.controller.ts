/**
 * 消息控制器
 */

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { MessageService } from './message.service';
import { SendMessageDto } from './dto/message.dto';
import { JwtAuthGuard } from '../../common/guards';
import { CurrentUser } from '../../common/decorators';
import { PaginationDto } from '../../common/dto';

@Controller('messages')
@UseGuards(JwtAuthGuard)
export class MessageController {
  constructor(private readonly messageService: MessageService) {}

  /**
   * 发送私信
   * POST /api/messages
   */
  @Post()
  sendMessage(
    @CurrentUser('id') userId: number,
    @Body() sendMessageDto: SendMessageDto,
  ) {
    return this.messageService.sendMessage(userId, sendMessageDto);
  }

  /**
   * 获取消息列表
   * GET /api/messages
   */
  @Get()
  getMessages(
    @CurrentUser('id') userId: number,
    @Query() pagination: PaginationDto,
  ) {
    return this.messageService.getMessages(
      userId,
      pagination.page,
      pagination.pageSize,
    );
  }

  /**
   * 获取与某用户的对话记录
   * GET /api/messages/conversation/:userId
   */
  @Get('conversation/:userId')
  getConversation(
    @CurrentUser('id') userId: number,
    @Param('userId', ParseIntPipe) otherUserId: number,
    @Query() pagination: PaginationDto,
  ) {
    return this.messageService.getConversation(
      userId,
      otherUserId,
      pagination.page,
      pagination.pageSize,
    );
  }

  /**
   * 标记消息为已读
   * POST /api/messages/:id/read
   */
  @Post(':id/read')
  markAsRead(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') userId: number,
  ) {
    return this.messageService.markAsRead(id, userId);
  }

  /**
   * 标记所有消息为已读
   * POST /api/messages/read-all
   */
  @Post('read-all')
  markAllAsRead(@CurrentUser('id') userId: number) {
    return this.messageService.markAllAsRead(userId);
  }
}
