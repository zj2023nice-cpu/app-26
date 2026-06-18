/**
 * 用户模块DTO
 * ============================================================================
 * 定义用户相关接口的请求参数结构
 * ============================================================================
 */

import { IsString, IsOptional, MaxLength, Matches } from 'class-validator';

/**
 * 更新用户资料DTO
 */
export class UpdateUserDto {
  /**
   * 昵称
   * - 可选
   * - 长度: 2-20位
   */
  @IsOptional()
  @IsString({ message: '昵称必须是字符串' })
  @MaxLength(20, { message: '昵称长度最多20位' })
  nickname?: string;

  /**
   * 头像URL
   * - 可选
   */
  @IsOptional()
  @IsString({ message: '头像必须是字符串' })
  avatar?: string;

  /**
   * 手机号
   * - 可选
   * - 必须是11位数字
   */
  @IsOptional()
  @IsString({ message: '手机号必须是字符串' })
  @Matches(/^1[3-9]\d{9}$/, { message: '手机号格式不正确' })
  phone?: string;

  /**
   * 校区
   * - 可选
   */
  @IsOptional()
  @IsString({ message: '校区必须是字符串' })
  @MaxLength(50, { message: '校区名称最多50个字符' })
  campus?: string;
}
