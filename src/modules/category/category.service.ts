/**
 * 分类服务
 * ============================================================================
 * CategoryService处理物品分类相关的业务逻辑
 * ============================================================================
 */

import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class CategoryService {
  constructor(private prisma: PrismaService) {}

  /**
   * 获取所有分类(树形结构)
   * 返回一级分类及其子分类
   */
  async findAll() {
    // 查询所有一级分类(parentId为null)及其子分类
    const categories = await this.prisma.category.findMany({
      where: { parentId: null }, // 只查询一级分类
      orderBy: { sort: 'asc' }, // 按排序字段排序
      include: {
        // 包含子分类
        children: {
          orderBy: { sort: 'asc' },
        },
      },
    });

    return categories;
  }

  /**
   * 获取所有分类(平铺列表)
   * 用于下拉选择等场景
   */
  async findAllFlat() {
    return this.prisma.category.findMany({
      orderBy: [{ parentId: 'asc' }, { sort: 'asc' }],
    });
  }

  /**
   * 根据ID获取分类详情
   */
  async findOne(id: number) {
    return this.prisma.category.findUnique({
      where: { id },
      include: {
        parent: true,
        children: true,
        _count: {
          select: { items: true },
        },
      },
    });
  }
}
