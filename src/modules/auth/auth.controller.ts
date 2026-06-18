/**
 * 认证控制器
 * ============================================================================
 * AuthController处理所有认证相关的HTTP请求:
 * - POST /api/auth/register - 用户注册
 * - POST /api/auth/login - 用户登录
 * - POST /api/auth/change-password - 修改密码
 * - POST /api/auth/refresh - 刷新Token
 * ============================================================================
 */

import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, ChangePasswordDto } from './dto/auth.dto';
import { Public } from '../../common/decorators';
import { JwtAuthGuard } from '../../common/guards';
import { CurrentUser } from '../../common/decorators';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * 用户注册
   * POST /api/auth/register
   *
   * @param registerDto - 注册信息
   * @returns 用户信息和访问令牌
   *
   * 请求示例:
   * POST /api/auth/register
   * {
   *   "studentId": "2021001",
   *   "password": "123456",
   *   "nickname": "张三"
   * }
   */
  @Public() // 公开接口,无需登录
  @Post('register')
  register(@Body() registerDto: RegisterDto) {
    return this.authService.register(registerDto);
  }

  /**
   * 用户登录
   * POST /api/auth/login
   *
   * @param loginDto - 登录信息
   * @returns 用户信息和访问令牌
   *
   * 请求示例:
   * POST /api/auth/login
   * {
   *   "studentId": "2021001",
   *   "password": "123456"
   * }
   *
   * 响应示例:
   * {
   *   "code": 200,
   *   "message": "success",
   *   "data": {
   *     "user": { "id": 1, "studentId": "2021001", ... },
   *     "accessToken": "eyJhbGciOiJIUzI1NiIs..."
   *   }
   * }
   */
  @Public()
  @Post('login')
  login(@Body() loginDto: LoginDto) {
    return this.authService.login(loginDto);
  }

  /**
   * 修改密码
   * POST /api/auth/change-password
   * 需要携带JWT Token
   *
   * @param user - 当前登录用户(从JWT解析)
   * @param changePasswordDto - 密码修改信息
   *
   * 请求示例:
   * POST /api/auth/change-password
   * Headers: { Authorization: "Bearer <token>" }
   * {
   *   "oldPassword": "123456",
   *   "newPassword": "654321"
   * }
   */
  @UseGuards(JwtAuthGuard)
  @Post('change-password')
  changePassword(
    @CurrentUser('id') userId: number,
    @Body() changePasswordDto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(userId, changePasswordDto);
  }

  /**
   * 刷新Token
   * POST /api/auth/refresh
   * 需要携带JWT Token
   *
   * @param user - 当前登录用户
   * @returns 新的访问令牌
   */
  @UseGuards(JwtAuthGuard)
  @Post('refresh')
  refreshToken(
    @CurrentUser('id') userId: number,
    @CurrentUser('studentId') studentId: string,
  ) {
    return this.authService.refreshToken(userId, studentId);
  }
}
