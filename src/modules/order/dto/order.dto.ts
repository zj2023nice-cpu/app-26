/**
 * 订单模块DTO
 */

import { IsString, IsNotEmpty, IsNumber, IsOptional, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * 创建订单DTO
 */
export class CreateOrderDto {
  /**
   * 物品ID
   */
  @IsNotEmpty({ message: '物品ID不能为空' })
  @Type(() => Number)
  @IsNumber({}, { message: '物品ID必须是数字' })
  itemId: number;

  /**
   * 备注
   */
  @IsOptional()
  @IsString({ message: '备注必须是字符串' })
  @MaxLength(500, { message: '备注最多500个字符' })
  remark?: string;
}
