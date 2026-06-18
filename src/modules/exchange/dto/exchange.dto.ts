/**
 * 互换模块DTO
 */

import { IsString, IsNotEmpty, IsNumber, IsOptional, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * 发起互换请求DTO
 */
export class CreateExchangeDto {
  /**
   * 对方的物品ID(想换的物品)
   */
  @IsNotEmpty({ message: '目标物品ID不能为空' })
  @Type(() => Number)
  @IsNumber({}, { message: '目标物品ID必须是数字' })
  ownerItemId: number;

  /**
   * 我方的物品ID(用于交换的物品)
   */
  @IsNotEmpty({ message: '交换物品ID不能为空' })
  @Type(() => Number)
  @IsNumber({}, { message: '交换物品ID必须是数字' })
  requesterItemId: number;

  /**
   * 互换说明
   */
  @IsOptional()
  @IsString({ message: '说明必须是字符串' })
  @MaxLength(500, { message: '说明最多500个字符' })
  message?: string;
}
