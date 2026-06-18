/**
 * 互换服务
 * ============================================================================
 * ExchangeService处理以物换物相关的业务逻辑
 * ============================================================================
 */

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateExchangeDto } from './dto/exchange.dto';
import { ExchangeStatus, ItemStatus, ItemType } from '@prisma/client';

@Injectable()
export class ExchangeService {
  constructor(private prisma: PrismaService) {}

  /**
   * 发起互换请求
   *
   * @param requesterId - 请求者ID
   * @param createExchangeDto - 互换信息
   */
  async create(requesterId: number, createExchangeDto: CreateExchangeDto) {
    const { ownerItemId, requesterItemId, message } = createExchangeDto;

    // 查询目标物品(对方的物品)
    const ownerItem = await this.prisma.item.findUnique({
      where: { id: ownerItemId },
    });

    if (!ownerItem) {
      throw new NotFoundException('目标物品不存在');
    }

    if (ownerItem.status !== ItemStatus.ACTIVE) {
      throw new BadRequestException('目标物品已下架或已售出');
    }

    if (ownerItem.type !== ItemType.EXCHANGE) {
      throw new BadRequestException('目标物品不支持互换');
    }

    // 不能和自己的物品互换
    if (ownerItem.userId === requesterId) {
      throw new BadRequestException('不能与自己的物品互换');
    }

    // 查询请求者的物品
    const requesterItem = await this.prisma.item.findUnique({
      where: { id: requesterItemId },
    });

    if (!requesterItem) {
      throw new NotFoundException('交换物品不存在');
    }

    if (requesterItem.userId !== requesterId) {
      throw new ForbiddenException('只能用自己的物品进行交换');
    }

    if (requesterItem.status !== ItemStatus.ACTIVE) {
      throw new BadRequestException('交换物品已下架或已售出');
    }

    // 检查是否已有相同的互换请求
    const existingExchange = await this.prisma.exchange.findFirst({
      where: {
        requesterId,
        ownerItemId,
        status: { in: [ExchangeStatus.PENDING, ExchangeStatus.ACCEPTED] },
      },
    });

    if (existingExchange) {
      throw new BadRequestException('已存在相同的互换请求');
    }

    // 创建互换请求
    const exchange = await this.prisma.exchange.create({
      data: {
        requesterId,
        ownerId: ownerItem.userId,
        requesterItemId,
        ownerItemId,
        message,
        status: ExchangeStatus.PENDING,
      },
      include: {
        requester: { select: { id: true, nickname: true, avatar: true } },
        owner: { select: { id: true, nickname: true, avatar: true } },
        requesterItem: { select: { id: true, title: true, images: true, price: true } },
        ownerItem: { select: { id: true, title: true, images: true, price: true } },
      },
    });

    return exchange;
  }

  /**
   * 获取我的互换记录
   *
   * @param userId - 用户ID
   * @param type - 类型: 'sent'发起的 | 'received'收到的
   * @param page - 页码
   * @param pageSize - 每页数量
   */
  async getMyExchanges(
    userId: number,
    type: 'sent' | 'received',
    page: number,
    pageSize: number,
  ) {
    const skip = (page - 1) * pageSize;

    const whereCondition =
      type === 'sent' ? { requesterId: userId } : { ownerId: userId };

    const [exchanges, total] = await Promise.all([
      this.prisma.exchange.findMany({
        where: whereCondition,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          requester: { select: { id: true, nickname: true, avatar: true } },
          owner: { select: { id: true, nickname: true, avatar: true } },
          requesterItem: { select: { id: true, title: true, images: true, price: true } },
          ownerItem: { select: { id: true, title: true, images: true, price: true } },
        },
      }),
      this.prisma.exchange.count({ where: whereCondition }),
    ]);

    return {
      list: exchanges,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  /**
   * 接受互换请求
   *
   * @param exchangeId - 互换请求ID
   * @param ownerId - 物品主人ID
   */
  async accept(exchangeId: number, ownerId: number) {
    const exchange = await this.prisma.exchange.findUnique({
      where: { id: exchangeId },
    });

    if (!exchange) {
      throw new NotFoundException('互换请求不存在');
    }

    if (exchange.ownerId !== ownerId) {
      throw new ForbiddenException('无权操作此互换请求');
    }

    if (exchange.status !== ExchangeStatus.PENDING) {
      throw new BadRequestException('互换请求状态不正确');
    }

    // 使用事务更新状态并锁定物品
    return this.prisma.$transaction(async (prisma) => {
      const updatedExchange = await prisma.exchange.update({
        where: { id: exchangeId },
        data: { status: ExchangeStatus.ACCEPTED },
      });

      // 将双方物品状态改为已预订
      await prisma.item.updateMany({
        where: { id: { in: [exchange.requesterItemId, exchange.ownerItemId] } },
        data: { status: ItemStatus.RESERVED },
      });

      return updatedExchange;
    });
  }

  /**
   * 拒绝互换请求
   *
   * @param exchangeId - 互换请求ID
   * @param ownerId - 物品主人ID
   */
  async reject(exchangeId: number, ownerId: number) {
    const exchange = await this.prisma.exchange.findUnique({
      where: { id: exchangeId },
    });

    if (!exchange) {
      throw new NotFoundException('互换请求不存在');
    }

    if (exchange.ownerId !== ownerId) {
      throw new ForbiddenException('无权操作此互换请求');
    }

    if (exchange.status !== ExchangeStatus.PENDING) {
      throw new BadRequestException('互换请求状态不正确');
    }

    return this.prisma.exchange.update({
      where: { id: exchangeId },
      data: { status: ExchangeStatus.REJECTED },
    });
  }

  /**
   * 确认互换完成
   * 需要双方都确认才能完成
   *
   * @param exchangeId - 互换请求ID
   * @param userId - 当前用户ID
   */
  async complete(exchangeId: number, userId: number) {
    const exchange = await this.prisma.exchange.findUnique({
      where: { id: exchangeId },
    });

    if (!exchange) {
      throw new NotFoundException('互换请求不存在');
    }

    // 只有双方参与者可以确认
    if (exchange.requesterId !== userId && exchange.ownerId !== userId) {
      throw new ForbiddenException('无权操作此互换请求');
    }

    if (exchange.status !== ExchangeStatus.ACCEPTED) {
      throw new BadRequestException('互换请求状态不正确');
    }

    // 使用事务完成互换
    return this.prisma.$transaction(async (prisma) => {
      const updatedExchange = await prisma.exchange.update({
        where: { id: exchangeId },
        data: { status: ExchangeStatus.COMPLETED },
      });

      // 将双方物品状态改为已售出
      await prisma.item.updateMany({
        where: { id: { in: [exchange.requesterItemId, exchange.ownerItemId] } },
        data: { status: ItemStatus.SOLD },
      });

      // 增加双方信用分
      await prisma.user.updateMany({
        where: { id: { in: [exchange.requesterId, exchange.ownerId] } },
        data: { creditScore: { increment: 5 } },
      });

      return updatedExchange;
    });
  }
}
