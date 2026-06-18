/**
 * 订单服务
 * ============================================================================
 * OrderService处理买卖订单相关的业务逻辑
 * ============================================================================
 */

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateOrderDto } from './dto/order.dto';
import { OrderStatus, ItemStatus } from '@prisma/client';

@Injectable()
export class OrderService {
  constructor(private prisma: PrismaService) {}

  /**
   * 生成订单编号
   * 格式: ORD + 年月日 + 6位随机数
   */
  private generateOrderNo(): string {
    const date = new Date();
    const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
    const random = Math.floor(Math.random() * 1000000)
      .toString()
      .padStart(6, '0');
    return `ORD${dateStr}${random}`;
  }

  /**
   * 创建订单(下单购买)
   *
   * @param buyerId - 买家ID
   * @param createOrderDto - 订单信息
   */
  async create(buyerId: number, createOrderDto: CreateOrderDto) {
    const { itemId, remark } = createOrderDto;

    // 查询物品信息
    const item = await this.prisma.item.findUnique({
      where: { id: itemId },
      include: { user: true },
    });

    if (!item) {
      throw new NotFoundException('物品不存在');
    }

    // 检查物品状态
    if (item.status !== ItemStatus.ACTIVE) {
      throw new BadRequestException('物品已下架或已售出');
    }

    // 不能购买自己的物品
    if (item.userId === buyerId) {
      throw new BadRequestException('不能购买自己的物品');
    }

    // 检查物品是否是出售类型
    if (item.type !== 'SELL') {
      throw new BadRequestException('该物品仅支持互换,不能直接购买');
    }

    // 使用事务创建订单并更新物品状态
    const order = await this.prisma.$transaction(async (prisma) => {
      // 创建订单
      const newOrder = await prisma.order.create({
        data: {
          orderNo: this.generateOrderNo(),
          price: item.price,
          remark,
          buyerId,
          sellerId: item.userId,
          itemId,
          status: OrderStatus.PENDING,
        },
        include: {
          item: { select: { id: true, title: true, images: true } },
          buyer: { select: { id: true, nickname: true, avatar: true } },
          seller: { select: { id: true, nickname: true, avatar: true } },
        },
      });

      // 更新物品状态为已预订
      await prisma.item.update({
        where: { id: itemId },
        data: { status: ItemStatus.RESERVED },
      });

      return newOrder;
    });

    return order;
  }

  /**
   * 获取订单详情
   *
   * @param orderId - 订单ID
   * @param userId - 当前用户ID
   */
  async findOne(orderId: number, userId: number) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: {
        item: {
          select: {
            id: true,
            title: true,
            description: true,
            images: true,
            price: true,
          },
        },
        buyer: {
          select: { id: true, nickname: true, avatar: true, phone: true, campus: true },
        },
        seller: {
          select: { id: true, nickname: true, avatar: true, phone: true, campus: true },
        },
        reviews: true,
      },
    });

    if (!order) {
      throw new NotFoundException('订单不存在');
    }

    // 只有买家或卖家可以查看订单详情
    if (order.buyerId !== userId && order.sellerId !== userId) {
      throw new ForbiddenException('无权查看此订单');
    }

    return order;
  }

  /**
   * 卖家确认订单
   *
   * @param orderId - 订单ID
   * @param sellerId - 卖家ID
   */
  async confirm(orderId: number, sellerId: number) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('订单不存在');
    }

    if (order.sellerId !== sellerId) {
      throw new ForbiddenException('无权操作此订单');
    }

    if (order.status !== OrderStatus.PENDING) {
      throw new BadRequestException('订单状态不正确');
    }

    return this.prisma.order.update({
      where: { id: orderId },
      data: { status: OrderStatus.CONFIRMED },
    });
  }

  /**
   * 买家确认收货(完成订单)
   *
   * @param orderId - 订单ID
   * @param buyerId - 买家ID
   */
  async complete(orderId: number, buyerId: number) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('订单不存在');
    }

    if (order.buyerId !== buyerId) {
      throw new ForbiddenException('无权操作此订单');
    }

    if (order.status !== OrderStatus.CONFIRMED) {
      throw new BadRequestException('订单状态不正确');
    }

    // 使用事务更新订单状态和物品状态
    return this.prisma.$transaction(async (prisma) => {
      const updatedOrder = await prisma.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.COMPLETED },
      });

      // 更新物品状态为已售出
      await prisma.item.update({
        where: { id: order.itemId },
        data: { status: ItemStatus.SOLD },
      });

      // 增加卖家信用分
      await prisma.user.update({
        where: { id: order.sellerId },
        data: { creditScore: { increment: 5 } },
      });

      return updatedOrder;
    });
  }

  /**
   * 取消订单
   *
   * @param orderId - 订单ID
   * @param userId - 当前用户ID
   */
  async cancel(orderId: number, userId: number) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('订单不存在');
    }

    // 买家或卖家都可以取消
    if (order.buyerId !== userId && order.sellerId !== userId) {
      throw new ForbiddenException('无权操作此订单');
    }

    // 只有待确认或已确认的订单可以取消
    if (
      order.status !== OrderStatus.PENDING &&
      order.status !== OrderStatus.CONFIRMED
    ) {
      throw new BadRequestException('订单状态不正确');
    }

    // 使用事务取消订单并恢复物品状态
    return this.prisma.$transaction(async (prisma) => {
      const updatedOrder = await prisma.order.update({
        where: { id: orderId },
        data: { status: OrderStatus.CANCELLED },
      });

      // 恢复物品状态为上架中
      await prisma.item.update({
        where: { id: order.itemId },
        data: { status: ItemStatus.ACTIVE },
      });

      return updatedOrder;
    });
  }
}
