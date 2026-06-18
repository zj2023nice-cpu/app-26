/**
 * 分页查询DTO
 * ============================================================================
 * DTO (Data Transfer Object) 是用于定义接口输入/输出数据结构的类
 * PaginationDto定义了分页查询的通用参数
 *
 * 使用class-validator装饰器进行参数验证
 * 使用class-transformer装饰器进行类型转换
 *
 * 使用示例:
 * GET /api/items?page=1&pageSize=10
 * ============================================================================
 */

import { IsOptional, IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * 分页查询参数DTO
 * 用于所有需要分页的列表接口
 */
export class PaginationDto {
  /**
   * 页码
   * - 默认值: 1 (第一页)
   * - 最小值: 1
   * - 可选参数
   */
  @IsOptional() // 可选参数
  @Type(() => Number) // 将查询参数字符串转换为数字
  @IsInt({ message: '页码必须是整数' }) // 验证为整数
  @Min(1, { message: '页码最小为1' }) // 最小值验证
  page: number = 1;

  /**
   * 每页数量
   * - 默认值: 10
   * - 最小值: 1
   * - 最大值: 100 (防止一次请求过多数据)
   * - 可选参数
   */
  @IsOptional()
  @Type(() => Number)
  @IsInt({ message: '每页数量必须是整数' })
  @Min(1, { message: '每页数量最小为1' })
  @Max(100, { message: '每页数量最大为100' })
  pageSize: number = 10;
}

/**
 * 分页响应接口
 * 定义分页响应的数据结构
 */
export interface PaginatedResult<T> {
  /** 数据列表 */
  list: T[];
  /** 分页元信息 */
  meta: {
    /** 当前页码 */
    page: number;
    /** 每页数量 */
    pageSize: number;
    /** 总数量 */
    total: number;
    /** 总页数 */
    totalPages: number;
  };
}

/**
 * 创建分页响应的工具函数
 *
 * @param data - 当前页的数据列表
 * @param total - 总记录数
 * @param page - 当前页码
 * @param pageSize - 每页数量
 * @returns 标准化的分页响应对象
 *
 * 使用示例:
 * ```typescript
 * const items = await prisma.item.findMany({ skip, take });
 * const total = await prisma.item.count();
 * return createPaginatedResult(items, total, page, pageSize);
 * ```
 */
export function createPaginatedResult<T>(
  data: T[],
  total: number,
  page: number,
  pageSize: number,
): PaginatedResult<T> {
  return {
    list: data,
    meta: {
      page,
      pageSize,
      total,
      totalPages: Math.ceil(total / pageSize), // 向上取整计算总页数
    },
  };
}
