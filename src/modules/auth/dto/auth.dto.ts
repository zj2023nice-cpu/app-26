/**
 * 认证模块DTO
 * ============================================================================
 * 定义认证相关接口的请求参数结构
 * ============================================================================
 */

import {
  IsString,
  IsNotEmpty,
  MinLength,
  MaxLength,
  Matches,
} from 'class-validator';

/**
 * 用户注册DTO
 * 定义注册接口需要的参数及验证规则
 */
export class RegisterDto {
  /**
   * 学号
   * - 必填
   * - 只能包含数字
   * - 长度: 5-20位
   */
  @IsNotEmpty({ message: '学号不能为空' })
  @IsString({ message: '学号必须是字符串' })
  @Matches(/^\d+$/, { message: '学号只能包含数字' })
  @MinLength(5, { message: '学号长度至少5位' })
  @MaxLength(20, { message: '学号长度最多20位' })
  studentId: string;

  /**
   * 密码
   * - 必填
   * - 长度: 6-20位
   */
  @IsNotEmpty({ message: '密码不能为空' })
  @IsString({ message: '密码必须是字符串' })
  @MinLength(6, { message: '密码长度至少6位' })
  @MaxLength(20, { message: '密码长度最多20位' })
  password: string;

  /**
   * 昵称
   * - 必填
   * - 长度: 2-20位
   */
  @IsNotEmpty({ message: '昵称不能为空' })
  @IsString({ message: '昵称必须是字符串' })
  @MinLength(2, { message: '昵称长度至少2位' })
  @MaxLength(20, { message: '昵称长度最多20位' })
  nickname: string;
}

/**
 * 用户登录DTO
 * 定义登录接口需要的参数
 */
export class LoginDto {
  /**
   * 学号
   */
  @IsNotEmpty({ message: '学号不能为空' })
  @IsString({ message: '学号必须是字符串' })
  studentId: string;

  /**
   * 密码
   */
  @IsNotEmpty({ message: '密码不能为空' })
  @IsString({ message: '密码必须是字符串' })
  password: string;
}

/**
 * 修改密码DTO
 */
export class ChangePasswordDto {
  /**
   * 旧密码
   */
  @IsNotEmpty({ message: '旧密码不能为空' })
  @IsString({ message: '旧密码必须是字符串' })
  oldPassword: string;

  /**
   * 新密码
   */
  @IsNotEmpty({ message: '新密码不能为空' })
  @IsString({ message: '新密码必须是字符串' })
  @MinLength(6, { message: '新密码长度至少6位' })
  @MaxLength(20, { message: '新密码长度最多20位' })
  newPassword: string;
}
