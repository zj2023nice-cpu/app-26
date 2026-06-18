/**
 * 评价模块DTO
 */

import { IsString, IsNotEmpty, IsNumber, IsOptional, Min, Max, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * 创建评价DTO
 */
export class CreateReviewDto {
  /**
   * 订单ID
   */
  @IsNotEmpty({ message: '订单ID不能为空' })
  @Type(() => Number)
  @IsNumber({}, { message: '订单ID必须是数字' })
  orderId: number;

  /**
   * 评分 1-5
   */
  @IsNotEmpty({ message: '评分不能为空' })
  @Type(() => Number)
  @IsNumber({}, { message: '评分必须是数字' })
  @Min(1, { message: '评分最低为1' })
  @Max(5, { message: '评分最高为5' })
  rating: number;

  /**
   * 评价内容
   */
  @IsOptional()
  @IsString({ message: '评价内容必须是字符串' })
  @MaxLength(500, { message: '评价内容最多500个字符' })
  content?: string;
}
