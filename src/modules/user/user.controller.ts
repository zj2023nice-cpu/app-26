/**
 * 用户控制器
 * ============================================================================
 * UserController处理用户相关的HTTP请求:
 * - GET /api/users/me - 获取当前用户信息
 * - PATCH /api/users/me - 更新个人资料
 * - GET /api/users/:id - 查看他人公开信息
 * - GET /api/users/me/items - 我发布的物品
 * - GET /api/users/me/orders - 我的订单
 * ============================================================================
 */

import {
  Controller,
  Get,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { UserService } from './user.service';
import { UpdateUserDto } from './dto/user.dto';
import { JwtAuthGuard } from '../../common/guards';
import { CurrentUser, Public } from '../../common/decorators';
import { PaginationDto } from '../../common/dto';

@Controller('users')
@UseGuards(JwtAuthGuard) // 整个控制器默认需要登录
export class UserController {
  constructor(private readonly userService: UserService) {}

  /**
   * 获取当前用户信息
   * GET /api/users/me
   */
  @Get('me')
  getCurrentUser(@CurrentUser('id') userId: number) {
    return this.userService.getCurrentUser(userId);
  }

  /**
   * 更新个人资料
   * PATCH /api/users/me
   */
  @Patch('me')
  updateUser(
    @CurrentUser('id') userId: number,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.userService.updateUser(userId, updateUserDto);
  }

  /**
   * 获取我发布的物品
   * GET /api/users/me/items
   */
  @Get('me/items')
  getMyItems(
    @CurrentUser('id') userId: number,
    @Query() pagination: PaginationDto,
  ) {
    return this.userService.getUserItems(
      userId,
      pagination.page,
      pagination.pageSize,
    );
  }

  /**
   * 获取我的订单
   * GET /api/users/me/orders?type=buy|sell
   */
  @Get('me/orders')
  getMyOrders(
    @CurrentUser('id') userId: number,
    @Query('type') type: 'buy' | 'sell' = 'buy',
    @Query() pagination: PaginationDto,
  ) {
    return this.userService.getUserOrders(
      userId,
      type,
      pagination.page,
      pagination.pageSize,
    );
  }

  /**
   * 查看他人公开信息
   * GET /api/users/:id
   * 公开接口,无需登录
   */
  @Public()
  @Get(':id')
  getUserPublicInfo(@Param('id', ParseIntPipe) userId: number) {
    return this.userService.getUserPublicInfo(userId);
  }
}
