/**
 * 评价服务
 * ============================================================================
 * ReviewService处理交易评价相关的业务逻辑
 * ============================================================================
 */

import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateReviewDto } from './dto/review.dto';
import { OrderStatus } from '@prisma/client';

@Injectable()
export class ReviewService {
  constructor(private prisma: PrismaService) {}

  /**
   * 创建评价
   *
   * @param fromUserId - 评价者ID
   * @param createReviewDto - 评价信息
   */
  async create(fromUserId: number, createReviewDto: CreateReviewDto) {
    const { orderId, rating, content } = createReviewDto;

    // 查询订单
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('订单不存在');
    }

    // 只有订单参与者可以评价
    if (order.buyerId !== fromUserId && order.sellerId !== fromUserId) {
      throw new ForbiddenException('无权评价此订单');
    }

    // 订单必须已完成
    if (order.status !== OrderStatus.COMPLETED) {
      throw new BadRequestException('只有已完成的订单才能评价');
    }

    // 检查是否已评价
    const existingReview = await this.prisma.review.findUnique({
      where: { orderId_fromUserId: { orderId, fromUserId } },
    });

    if (existingReview) {
      throw new BadRequestException('您已评价过此订单');
    }

    // 确定被评价者
    const toUserId =
      fromUserId === order.buyerId ? order.sellerId : order.buyerId;

    // 创建评价
    const review = await this.prisma.review.create({
      data: {
        orderId,
        fromUserId,
        toUserId,
        rating,
        content,
      },
      include: {
        fromUser: { select: { id: true, nickname: true, avatar: true } },
        toUser: { select: { id: true, nickname: true, avatar: true } },
        order: { select: { id: true, orderNo: true } },
      },
    });

    // 根据评分更新被评价者信用分
    // 好评(4-5分)加分,差评(1-2分)减分
    let creditChange = 0;
    if (rating >= 4) {
      creditChange = rating - 3; // 4分+1, 5分+2
    } else if (rating <= 2) {
      creditChange = rating - 3; // 2分-1, 1分-2
    }

    if (creditChange !== 0) {
      await this.prisma.user.update({
        where: { id: toUserId },
        data: { creditScore: { increment: creditChange } },
      });
    }

    return review;
  }

  /**
   * 获取用户收到的评价
   *
   * @param userId - 用户ID
   * @param page - 页码
   * @param pageSize - 每页数量
   */
  async getUserReviews(userId: number, page: number, pageSize: number) {
    const skip = (page - 1) * pageSize;

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where: { toUserId: userId },
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          fromUser: { select: { id: true, nickname: true, avatar: true } },
          order: {
            select: {
              id: true,
              orderNo: true,
              item: { select: { id: true, title: true } },
            },
          },
        },
      }),
      this.prisma.review.count({ where: { toUserId: userId } }),
    ]);

    // 计算平均评分
    const avgRating = await this.prisma.review.aggregate({
      where: { toUserId: userId },
      _avg: { rating: true },
    });

    return {
      list: reviews,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
        avgRating: avgRating._avg.rating || 0,
      },
    };
  }

  /**
   * 获取订单的评价
   *
   * @param orderId - 订单ID
   */
  async getOrderReviews(orderId: number) {
    return this.prisma.review.findMany({
      where: { orderId },
      include: {
        fromUser: { select: { id: true, nickname: true, avatar: true } },
        toUser: { select: { id: true, nickname: true, avatar: true } },
      },
    });
  }
}
