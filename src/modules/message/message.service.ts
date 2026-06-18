/**
 * 消息服务
 * ============================================================================
 * MessageService处理站内消息相关的业务逻辑
 * ============================================================================
 */

import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SendMessageDto } from './dto/message.dto';
import { MessageType } from '@prisma/client';

@Injectable()
export class MessageService {
  constructor(private prisma: PrismaService) {}

  /**
   * 发送私信
   *
   * @param senderId - 发送者ID
   * @param sendMessageDto - 消息信息
   */
  async sendMessage(senderId: number, sendMessageDto: SendMessageDto) {
    const { receiverId, content } = sendMessageDto;

    // 不能给自己发消息
    if (senderId === receiverId) {
      throw new BadRequestException('不能给自己发送消息');
    }

    // 检查接收者是否存在
    const receiver = await this.prisma.user.findUnique({
      where: { id: receiverId },
    });

    if (!receiver) {
      throw new NotFoundException('接收者不存在');
    }

    // 创建消息
    const message = await this.prisma.message.create({
      data: {
        senderId,
        receiverId,
        content,
        type: MessageType.PRIVATE,
      },
      include: {
        sender: { select: { id: true, nickname: true, avatar: true } },
        receiver: { select: { id: true, nickname: true, avatar: true } },
      },
    });

    return message;
  }

  /**
   * 获取消息列表
   *
   * @param userId - 用户ID
   * @param page - 页码
   * @param pageSize - 每页数量
   */
  async getMessages(userId: number, page: number, pageSize: number) {
    const skip = (page - 1) * pageSize;

    const [messages, total] = await Promise.all([
      this.prisma.message.findMany({
        where: { receiverId: userId },
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          sender: { select: { id: true, nickname: true, avatar: true } },
        },
      }),
      this.prisma.message.count({ where: { receiverId: userId } }),
    ]);

    // 统计未读数量
    const unreadCount = await this.prisma.message.count({
      where: { receiverId: userId, isRead: false },
    });

    return {
      list: messages,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
        unreadCount,
      },
    };
  }

  /**
   * 获取与某用户的对话记录
   *
   * @param userId - 当前用户ID
   * @param otherUserId - 对方用户ID
   * @param page - 页码
   * @param pageSize - 每页数量
   */
  async getConversation(
    userId: number,
    otherUserId: number,
    page: number,
    pageSize: number,
  ) {
    const skip = (page - 1) * pageSize;

    const [messages, total] = await Promise.all([
      this.prisma.message.findMany({
        where: {
          OR: [
            { senderId: userId, receiverId: otherUserId },
            { senderId: otherUserId, receiverId: userId },
          ],
        },
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          sender: { select: { id: true, nickname: true, avatar: true } },
          receiver: { select: { id: true, nickname: true, avatar: true } },
        },
      }),
      this.prisma.message.count({
        where: {
          OR: [
            { senderId: userId, receiverId: otherUserId },
            { senderId: otherUserId, receiverId: userId },
          ],
        },
      }),
    ]);

    // 将对方发来的未读消息标记为已读
    await this.prisma.message.updateMany({
      where: {
        senderId: otherUserId,
        receiverId: userId,
        isRead: false,
      },
      data: { isRead: true },
    });

    return {
      list: messages.reverse(), // 按时间正序返回
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  /**
   * 标记消息为已读
   *
   * @param messageId - 消息ID
   * @param userId - 当前用户ID
   */
  async markAsRead(messageId: number, userId: number) {
    const message = await this.prisma.message.findUnique({
      where: { id: messageId },
    });

    if (!message) {
      throw new NotFoundException('消息不存在');
    }

    // 只有接收者可以标记为已读
    if (message.receiverId !== userId) {
      throw new BadRequestException('无权操作此消息');
    }

    return this.prisma.message.update({
      where: { id: messageId },
      data: { isRead: true },
    });
  }

  /**
   * 标记所有消息为已读
   *
   * @param userId - 用户ID
   */
  async markAllAsRead(userId: number) {
    await this.prisma.message.updateMany({
      where: { receiverId: userId, isRead: false },
      data: { isRead: true },
    });

    return { message: '已全部标记为已读' };
  }
}
