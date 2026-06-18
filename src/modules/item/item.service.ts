/**
 * 物品服务
 * ============================================================================
 * ItemService处理物品相关的业务逻辑:
 * - 物品发布、编辑、删除
 * - 物品查询、搜索
 * - 物品收藏
 * - 物品状态管理
 * ============================================================================
 */

import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { CreateItemDto, UpdateItemDto, QueryItemDto } from './dto/item.dto';
import { ItemStatus } from '@prisma/client';

@Injectable()
export class ItemService {
  constructor(private prisma: PrismaService) {}

  /**
   * 发布物品
   *
   * @param userId - 发布者ID
   * @param createItemDto - 物品信息
   */
  async create(userId: number, createItemDto: CreateItemDto) {
    // 验证分类是否存在
    const category = await this.prisma.category.findUnique({
      where: { id: createItemDto.categoryId },
    });

    if (!category) {
      throw new BadRequestException('分类不存在');
    }

    // 创建物品,默认状态为上架中(ACTIVE)
    const item = await this.prisma.item.create({
      data: {
        ...createItemDto,
        userId,
        status: ItemStatus.ACTIVE,
        images: createItemDto.images || '[]',
      },
      include: {
        category: { select: { id: true, name: true } },
        user: { select: { id: true, nickname: true, avatar: true } },
      },
    });

    return item;
  }

  /**
   * 查询物品列表
   * 支持关键词搜索、分类筛选、价格区间、排序等
   *
   * @param queryDto - 查询参数
   */
  async findAll(queryDto: QueryItemDto) {
    const {
      page = 1,
      pageSize = 10,
      keyword,
      categoryId,
      type,
      minPrice,
      maxPrice,
      sortBy = 'createdAt',
      sortOrder = 'desc',
    } = queryDto;

    // 构建查询条件
    const where: any = {
      status: ItemStatus.ACTIVE, // 只查询上架中的物品
    };

    // 关键词搜索(标题或描述包含关键词)
    if (keyword) {
      where.OR = [
        { title: { contains: keyword } },
        { description: { contains: keyword } },
      ];
    }

    // 分类筛选
    if (categoryId) {
      // 查询该分类及其子分类下的物品
      const category = await this.prisma.category.findUnique({
        where: { id: categoryId },
        include: { children: { select: { id: true } } },
      });

      if (category) {
        const categoryIds = [
          categoryId,
          ...category.children.map((c) => c.id),
        ];
        where.categoryId = { in: categoryIds };
      }
    }

    // 类型筛选
    if (type) {
      where.type = type;
    }

    // 价格区间
    if (minPrice !== undefined || maxPrice !== undefined) {
      where.price = {};
      if (minPrice !== undefined) where.price.gte = minPrice;
      if (maxPrice !== undefined) where.price.lte = maxPrice;
    }

    // 构建排序条件
    const orderBy: any = {};
    if (['createdAt', 'price', 'viewCount'].includes(sortBy)) {
      orderBy[sortBy] = sortOrder;
    }

    // 分页参数
    const skip = (page - 1) * pageSize;

    // 执行查询
    const [items, total] = await Promise.all([
      this.prisma.item.findMany({
        where,
        skip,
        take: pageSize,
        orderBy,
        include: {
          category: { select: { id: true, name: true } },
          user: { select: { id: true, nickname: true, avatar: true, campus: true } },
          _count: { select: { favorites: true } },
        },
      }),
      this.prisma.item.count({ where }),
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
   * 获取物品详情
   * 同时增加浏览次数
   *
   * @param id - 物品ID
   * @param userId - 当前用户ID(可选,用于判断是否收藏)
   */
  async findOne(id: number, userId?: number) {
    const item = await this.prisma.item.findUnique({
      where: { id },
      include: {
        category: { select: { id: true, name: true } },
        user: {
          select: {
            id: true,
            nickname: true,
            avatar: true,
            campus: true,
            creditScore: true,
          },
        },
        _count: { select: { favorites: true } },
      },
    });

    if (!item) {
      throw new NotFoundException('物品不存在');
    }

    // 增加浏览次数(异步执行,不阻塞响应)
    this.prisma.item
      .update({
        where: { id },
        data: { viewCount: { increment: 1 } },
      })
      .catch(() => {}); // 忽略错误

    // 检查当前用户是否收藏
    let isFavorited = false;
    if (userId) {
      const favorite = await this.prisma.favorite.findUnique({
        where: { userId_itemId: { userId, itemId: id } },
      });
      isFavorited = !!favorite;
    }

    return {
      ...item,
      isFavorited,
    };
  }

  /**
   * 更新物品
   *
   * @param id - 物品ID
   * @param userId - 当前用户ID
   * @param updateItemDto - 更新内容
   */
  async update(id: number, userId: number, updateItemDto: UpdateItemDto) {
    // 检查物品是否存在且属于当前用户
    const item = await this.prisma.item.findUnique({
      where: { id },
    });

    if (!item) {
      throw new NotFoundException('物品不存在');
    }

    if (item.userId !== userId) {
      throw new ForbiddenException('无权操作此物品');
    }

    // 如果要更新分类,验证分类是否存在
    if (updateItemDto.categoryId) {
      const category = await this.prisma.category.findUnique({
        where: { id: updateItemDto.categoryId },
      });
      if (!category) {
        throw new BadRequestException('分类不存在');
      }
    }

    // 更新物品
    return this.prisma.item.update({
      where: { id },
      data: updateItemDto,
      include: {
        category: { select: { id: true, name: true } },
        user: { select: { id: true, nickname: true, avatar: true } },
      },
    });
  }

  /**
   * 删除物品
   *
   * @param id - 物品ID
   * @param userId - 当前用户ID
   */
  async remove(id: number, userId: number) {
    // 检查物品是否存在且属于当前用户
    const item = await this.prisma.item.findUnique({
      where: { id },
    });

    if (!item) {
      throw new NotFoundException('物品不存在');
    }

    if (item.userId !== userId) {
      throw new ForbiddenException('无权操作此物品');
    }

    // 检查是否有进行中的订单
    const activeOrder = await this.prisma.order.findFirst({
      where: {
        itemId: id,
        status: { in: ['PENDING', 'CONFIRMED'] },
      },
    });

    if (activeOrder) {
      throw new BadRequestException('物品有进行中的订单,无法删除');
    }

    // 删除物品
    await this.prisma.item.delete({ where: { id } });

    return { message: '删除成功' };
  }

  /**
   * 下架物品
   *
   * @param id - 物品ID
   * @param userId - 当前用户ID
   */
  async offShelf(id: number, userId: number) {
    const item = await this.prisma.item.findUnique({
      where: { id },
    });

    if (!item) {
      throw new NotFoundException('物品不存在');
    }

    if (item.userId !== userId) {
      throw new ForbiddenException('无权操作此物品');
    }

    return this.prisma.item.update({
      where: { id },
      data: { status: ItemStatus.OFF_SHELF },
    });
  }

  /**
   * 重新上架物品
   *
   * @param id - 物品ID
   * @param userId - 当前用户ID
   */
  async onShelf(id: number, userId: number) {
    const item = await this.prisma.item.findUnique({
      where: { id },
    });

    if (!item) {
      throw new NotFoundException('物品不存在');
    }

    if (item.userId !== userId) {
      throw new ForbiddenException('无权操作此物品');
    }

    if (item.status !== ItemStatus.OFF_SHELF) {
      throw new BadRequestException('只有已下架的物品才能重新上架');
    }

    return this.prisma.item.update({
      where: { id },
      data: { status: ItemStatus.ACTIVE },
    });
  }

  /**
   * 收藏物品
   *
   * @param itemId - 物品ID
   * @param userId - 用户ID
   */
  async addFavorite(itemId: number, userId: number) {
    // 检查物品是否存在
    const item = await this.prisma.item.findUnique({
      where: { id: itemId },
    });

    if (!item) {
      throw new NotFoundException('物品不存在');
    }

    // 不能收藏自己的物品
    if (item.userId === userId) {
      throw new BadRequestException('不能收藏自己的物品');
    }

    // 创建收藏记录(如果已存在则忽略)
    await this.prisma.favorite.upsert({
      where: { userId_itemId: { userId, itemId } },
      create: { userId, itemId },
      update: {},
    });

    return { message: '收藏成功' };
  }

  /**
   * 取消收藏
   *
   * @param itemId - 物品ID
   * @param userId - 用户ID
   */
  async removeFavorite(itemId: number, userId: number) {
    await this.prisma.favorite.deleteMany({
      where: { userId, itemId },
    });

    return { message: '取消收藏成功' };
  }

  /**
   * 获取用户收藏列表
   *
   * @param userId - 用户ID
   * @param page - 页码
   * @param pageSize - 每页数量
   */
  async getFavorites(userId: number, page: number, pageSize: number) {
    const skip = (page - 1) * pageSize;

    const [favorites, total] = await Promise.all([
      this.prisma.favorite.findMany({
        where: { userId },
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        include: {
          item: {
            include: {
              category: { select: { id: true, name: true } },
              user: { select: { id: true, nickname: true, avatar: true } },
            },
          },
        },
      }),
      this.prisma.favorite.count({ where: { userId } }),
    ]);

    return {
      list: favorites.map((f) => f.item),
      meta: {
        page,
        pageSize,
        total,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }
}
