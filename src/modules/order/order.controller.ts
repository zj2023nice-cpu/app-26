/**
 * 订单控制器
 */

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { OrderService } from './order.service';
import { CreateOrderDto } from './dto/order.dto';
import { JwtAuthGuard } from '../../common/guards';
import { CurrentUser } from '../../common/decorators';

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrderController {
  constructor(private readonly orderService: OrderService) {}

  /**
   * 创建订单
   * POST /api/orders
   */
  @Post()
  create(
    @CurrentUser('id') userId: number,
    @Body() createOrderDto: CreateOrderDto,
  ) {
    return this.orderService.create(userId, createOrderDto);
  }

  /**
   * 获取订单详情
   * GET /api/orders/:id
   */
  @Get(':id')
  findOne(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') userId: number,
  ) {
    return this.orderService.findOne(id, userId);
  }

  /**
   * 卖家确认订单
   * POST /api/orders/:id/confirm
   */
  @Post(':id/confirm')
  confirm(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') userId: number,
  ) {
    return this.orderService.confirm(id, userId);
  }

  /**
   * 买家确认收货
   * POST /api/orders/:id/complete
   */
  @Post(':id/complete')
  complete(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') userId: number,
  ) {
    return this.orderService.complete(id, userId);
  }

  /**
   * 取消订单
   * POST /api/orders/:id/cancel
   */
  @Post(':id/cancel')
  cancel(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') userId: number,
  ) {
    return this.orderService.cancel(id, userId);
  }
}
