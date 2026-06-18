/**
 * 物品控制器
 * ============================================================================
 * ItemController处理物品相关的HTTP请求
 * ============================================================================
 */

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ItemService } from './item.service';
import { CreateItemDto, UpdateItemDto, QueryItemDto } from './dto/item.dto';
import { JwtAuthGuard } from '../../common/guards';
import { CurrentUser, Public } from '../../common/decorators';
import { PaginationDto } from '../../common/dto';

@Controller('items')
export class ItemController {
  constructor(private readonly itemService: ItemService) {}

  /**
   * 发布物品
   * POST /api/items
   */
  @UseGuards(JwtAuthGuard)
  @Post()
  create(
    @CurrentUser('id') userId: number,
    @Body() createItemDto: CreateItemDto,
  ) {
    return this.itemService.create(userId, createItemDto);
  }

  /**
   * 获取物品列表
   * GET /api/items
   * 公开接口,支持搜索和筛选
   */
  @Public()
  @Get()
  findAll(@Query() queryDto: QueryItemDto) {
    return this.itemService.findAll(queryDto);
  }

  /**
   * 获取收藏列表
   * GET /api/items/favorites
   */
  @UseGuards(JwtAuthGuard)
  @Get('favorites')
  getFavorites(
    @CurrentUser('id') userId: number,
    @Query() pagination: PaginationDto,
  ) {
    return this.itemService.getFavorites(
      userId,
      pagination.page,
      pagination.pageSize,
    );
  }

  /**
   * 获取物品详情
   * GET /api/items/:id
   * 公开接口
   */
  @Public()
  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') userId: number,
  ) {
    return this.itemService.findOne(id, userId);
  }

  /**
   * 更新物品
   * PATCH /api/items/:id
   */
  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') userId: number,
    @Body() updateItemDto: UpdateItemDto,
  ) {
    return this.itemService.update(id, userId, updateItemDto);
  }

  /**
   * 删除物品
   * DELETE /api/items/:id
   */
  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  remove(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') userId: number,
  ) {
    return this.itemService.remove(id, userId);
  }

  /**
   * 下架物品
   * POST /api/items/:id/off-shelf
   */
  @UseGuards(JwtAuthGuard)
  @Post(':id/off-shelf')
  offShelf(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') userId: number,
  ) {
    return this.itemService.offShelf(id, userId);
  }

  /**
   * 重新上架物品
   * POST /api/items/:id/on-shelf
   */
  @UseGuards(JwtAuthGuard)
  @Post(':id/on-shelf')
  onShelf(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') userId: number,
  ) {
    return this.itemService.onShelf(id, userId);
  }

  /**
   * 收藏物品
   * POST /api/items/:id/favorite
   */
  @UseGuards(JwtAuthGuard)
  @Post(':id/favorite')
  addFavorite(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') userId: number,
  ) {
    return this.itemService.addFavorite(id, userId);
  }

  /**
   * 取消收藏
   * DELETE /api/items/:id/favorite
   */
  @UseGuards(JwtAuthGuard)
  @Delete(':id/favorite')
  removeFavorite(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') userId: number,
  ) {
    return this.itemService.removeFavorite(id, userId);
  }
}
