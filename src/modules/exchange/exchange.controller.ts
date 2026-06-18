/**
 * 互换控制器
 */

import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  ParseIntPipe,
} from '@nestjs/common';
import { ExchangeService } from './exchange.service';
import { CreateExchangeDto } from './dto/exchange.dto';
import { JwtAuthGuard } from '../../common/guards';
import { CurrentUser } from '../../common/decorators';
import { PaginationDto } from '../../common/dto';

@Controller('exchanges')
@UseGuards(JwtAuthGuard)
export class ExchangeController {
  constructor(private readonly exchangeService: ExchangeService) {}

  /**
   * 发起互换请求
   * POST /api/exchanges
   */
  @Post()
  create(
    @CurrentUser('id') userId: number,
    @Body() createExchangeDto: CreateExchangeDto,
  ) {
    return this.exchangeService.create(userId, createExchangeDto);
  }

  /**
   * 获取我的互换记录
   * GET /api/exchanges/my?type=sent|received
   */
  @Get('my')
  getMyExchanges(
    @CurrentUser('id') userId: number,
    @Query('type') type: 'sent' | 'received' = 'sent',
    @Query() pagination: PaginationDto,
  ) {
    return this.exchangeService.getMyExchanges(
      userId,
      type,
      pagination.page,
      pagination.pageSize,
    );
  }

  /**
   * 接受互换请求
   * POST /api/exchanges/:id/accept
   */
  @Post(':id/accept')
  accept(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') userId: number,
  ) {
    return this.exchangeService.accept(id, userId);
  }

  /**
   * 拒绝互换请求
   * POST /api/exchanges/:id/reject
   */
  @Post(':id/reject')
  reject(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') userId: number,
  ) {
    return this.exchangeService.reject(id, userId);
  }

  /**
   * 确认互换完成
   * POST /api/exchanges/:id/complete
   */
  @Post(':id/complete')
  complete(
    @Param('id', ParseIntPipe) id: number,
    @CurrentUser('id') userId: number,
  ) {
    return this.exchangeService.complete(id, userId);
  }
}
