/**
 * 用户服务
 * ============================================================================
 * UserService处理用户相关的业务逻辑:
 * - 获取用户信息
 * - 更新用户资料
 * - 查看他人公开信息
 * ============================================================================
 */

import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UpdateUserDto } from './dto/user.dto';

@Injectable()
export class UserService {
  constructor(private prisma: PrismaService) {}

  /**
   * 获取当前用户信息
   *
   * @param userId - 用户ID
   * @returns 用户完整信息
   */
  async getCurrentUser(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        studentId: true,
        nickname: true,
        avatar: true,
        phone: true,
        campus: true,
        creditScore: true,
        createdAt: true,
        updatedAt: true,
        // 统计数据
        _count: {
          select: {
            items: true, // 发布的物品数量
            buyOrders: true, // 购买订单数量
            sellOrders: true, // 卖出订单数量
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    return user;
  }

  /**
   * 更新用户资料
   *
   * @param userId - 用户ID
   * @param updateUserDto - 更新的字段
   * @returns 更新后的用户信息
   */
  async updateUser(userId: number, updateUserDto: UpdateUserDto) {
    const user = await this.prisma.user.update({
      where: { id: userId },
      data: updateUserDto,
      select: {
        id: true,
        studentId: true,
        nickname: true,
        avatar: true,
        phone: true,
        campus: true,
        creditScore: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return user;
  }

  /**
   * 查看他人公开信息
   * 只返回公开字段,不包含手机号等隐私信息
   *
   * @param userId - 要查看的用户ID
   * @returns 用户公开信息
   */
  async getUserPublicInfo(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        nickname: true,
        avatar: true,
        campus: true,
        creditScore: true,
        createdAt: true,
        // 统计信息
        _count: {
          select: {
            items: {
              where: { status: 'ACTIVE' }, // 只统计上架中的物品
            },
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('用户不存在');
    }

    return user;
  }

  /**
   * 获取用户发布的物品列表
   *
   * @param userId - 用户ID
   * @param page - 页码
   * @param pageSize - 每页数量
   * @returns 物品列表
   */
  async getUserItems(userId: number, page: number, pageSize: number) {
    const skip = (page - 1) * pageSize;

    const [items, total] = await Promise.all([
      this.prisma.item.findMany({
        where: { userId },
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          category: {
            select: { id: true, name: true },
          },
        },
      }),
      this.prisma.item.count({ where: { userId } }),
    ]);

    return {
      list: items,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  /**
   * 获取用户的订单列表
   *
   * @param userId - 用户ID
   * @param type - 订单类型: 'buy'买入 | 'sell'卖出
   * @param page - 页码
   * @param pageSize - 每页数量
   */
  async getUserOrders(
    userId: number,
    type: 'buy' | 'sell',
    page: number,
    pageSize: number,
  ) {
    const skip = (page - 1) * pageSize;

    // 根据类型确定查询条件
    const whereCondition =
      type === 'buy' ? { buyerId: userId } : { sellerId: userId };

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where: whereCondition,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          item: {
            select: {
              id: true,
              title: true,
              images: true,
              price: true,
            },
          },
          buyer: {
            select: { id: true, nickname: true, avatar: true },
          },
          seller: {
            select: { id: true, nickname: true, avatar: true },
          },
        },
      }),
      this.prisma.order.count({ where: whereCondition }),
    ]);

    return {
      list: orders,
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }
}
