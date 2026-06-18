/**
 * 分类控制器
 * ============================================================================
 * CategoryController处理分类相关的HTTP请求
 * 所有分类接口都是公开的,无需登录
 * ============================================================================
 */

import { Controller, Get, Param, ParseIntPipe } from '@nestjs/common';
import { CategoryService } from './category.service';
import { Public } from '../../common/decorators';

@Controller('categories')
export class CategoryController {
  constructor(private readonly categoryService: CategoryService) {}

  /**
   * 获取所有分类(树形结构)
   * GET /api/categories
   */
  @Public()
  @Get()
  findAll() {
    return this.categoryService.findAll();
  }

  /**
   * 获取所有分类(平铺列表)
   * GET /api/categories/flat
   */
  @Public()
  @Get('flat')
  findAllFlat() {
    return this.categoryService.findAllFlat();
  }

  /**
   * 获取分类详情
   * GET /api/categories/:id
   */
  @Public()
  @Get(':id')
  findOne(@Param('id', ParseIntPipe) id: number) {
    return this.categoryService.findOne(id);
  }
}
