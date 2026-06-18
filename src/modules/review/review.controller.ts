/**
 * 评价控制器
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
import { ReviewService } from './review.service';
import { CreateReviewDto } from './dto/review.dto';
import { JwtAuthGuard } from '../../common/guards';
import { CurrentUser, Public } from '../../common/decorators';
import { PaginationDto } from '../../common/dto';

@Controller('reviews')
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  /**
   * 创建评价
   * POST /api/reviews
   */
  @UseGuards(JwtAuthGuard)
  @Post()
  create(
    @CurrentUser('id') userId: number,
    @Body() createReviewDto: CreateReviewDto,
  ) {
    return this.reviewService.create(userId, createReviewDto);
  }

  /**
   * 获取用户收到的评价
   * GET /api/reviews/user/:userId
   * 公开接口
   */
  @Public()
  @Get('user/:userId')
  getUserReviews(
    @Param('userId', ParseIntPipe) userId: number,
    @Query() pagination: PaginationDto,
  ) {
    return this.reviewService.getUserReviews(
      userId,
      pagination.page,
      pagination.pageSize,
    );
  }

  /**
   * 获取订单的评价
   * GET /api/reviews/order/:orderId
   */
  @UseGuards(JwtAuthGuard)
  @Get('order/:orderId')
  getOrderReviews(@Param('orderId', ParseIntPipe) orderId: number) {
    return this.reviewService.getOrderReviews(orderId);
  }
}
