/**
 * 物品模块DTO
 * ============================================================================
 * 定义物品相关接口的请求参数结构
 * ============================================================================
 */

import {
  IsString,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsEnum,
  IsArray,
  Min,
  MaxLength,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ItemType, ItemStatus } from '@prisma/client';
import { PaginationDto } from '../../../common/dto';

/**
 * 创建物品DTO
 */
export class CreateItemDto {
  /**
   * 物品标题
   */
  @IsNotEmpty({ message: '标题不能为空' })
  @IsString({ message: '标题必须是字符串' })
  @MaxLength(100, { message: '标题最多100个字符' })
  title: string;

  /**
   * 物品描述
   */
  @IsNotEmpty({ message: '描述不能为空' })
  @IsString({ message: '描述必须是字符串' })
  @MaxLength(2000, { message: '描述最多2000个字符' })
  description: string;

  /**
   * 价格
   * 对于互换类型,可以设为0或估值价格
   */
  @IsNotEmpty({ message: '价格不能为空' })
  @Type(() => Number)
  @IsNumber({}, { message: '价格必须是数字' })
  @Min(0, { message: '价格不能为负数' })
  price: number;

  /**
   * 图片URL列表(JSON字符串)
   */
  @IsOptional()
  @IsString({ message: '图片必须是字符串' })
  images?: string = '[]';

  /**
   * 物品类型: SELL出售 / EXCHANGE互换
   */
  @IsNotEmpty({ message: '物品类型不能为空' })
  @IsEnum(ItemType, { message: '物品类型不正确' })
  type: ItemType;

  /**
   * 分类ID
   */
  @IsNotEmpty({ message: '分类不能为空' })
  @Type(() => Number)
  @IsNumber({}, { message: '分类ID必须是数字' })
  categoryId: number;
}

/**
 * 更新物品DTO
 */
export class UpdateItemDto {
  @IsOptional()
  @IsString({ message: '标题必须是字符串' })
  @MaxLength(100, { message: '标题最多100个字符' })
  title?: string;

  @IsOptional()
  @IsString({ message: '描述必须是字符串' })
  @MaxLength(2000, { message: '描述最多2000个字符' })
  description?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: '价格必须是数字' })
  @Min(0, { message: '价格不能为负数' })
  price?: number;

  @IsOptional()
  @IsString({ message: '图片必须是字符串' })
  images?: string;

  @IsOptional()
  @IsEnum(ItemType, { message: '物品类型不正确' })
  type?: ItemType;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({}, { message: '分类ID必须是数字' })
  categoryId?: number;
}

/**
 * 物品查询DTO
 */
export class QueryItemDto extends PaginationDto {
  /**
   * 搜索关键词
   */
  @IsOptional()
  @IsString()
  keyword?: string;

  /**
   * 分类ID
   */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  categoryId?: number;

  /**
   * 物品类型
   */
  @IsOptional()
  @IsEnum(ItemType)
  type?: ItemType;

  /**
   * 最低价格
   */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number;

  /**
   * 最高价格
   */
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  /**
   * 排序字段: createdAt/price/viewCount
   */
  @IsOptional()
  @IsString()
  sortBy?: string = 'createdAt';

  /**
   * 排序方向: asc/desc
   */
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'desc';
}
