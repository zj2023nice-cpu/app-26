/**
 * 认证服务
 * ============================================================================
 * AuthService负责处理所有认证相关的业务逻辑:
 * 1. 用户注册 - 创建新用户账号
 * 2. 用户登录 - 验证凭据并签发JWT
 * 3. 密码修改 - 验证旧密码并更新
 * 4. Token刷新 - 生成新的访问令牌
 * ============================================================================
 */

import {
  Injectable,
  UnauthorizedException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../prisma/prisma.service';
import { RegisterDto, LoginDto, ChangePasswordDto } from './dto/auth.dto';

/**
 * JWT载荷接口
 * 定义JWT Token中包含的用户信息
 */
export interface JwtPayload {
  sub: number; // 用户ID (sub是JWT标准字段名,表示subject)
  studentId: string; // 学号
}

@Injectable()
export class AuthService {
  /**
   * 构造函数 - 注入依赖
   * @param prisma - 数据库服务
   * @param jwtService - JWT服务,用于生成和验证Token
   */
  constructor(
    private prisma: PrismaService,
    private jwtService: JwtService,
  ) {}

  /**
   * 用户注册
   * 创建新用户账号,密码使用bcrypt加密存储
   *
   * @param registerDto - 注册信息(学号、密码、昵称)
   * @returns 新创建的用户信息(不含密码)和访问令牌
   * @throws ConflictException 学号已被注册时抛出
   */
  async register(registerDto: RegisterDto) {
    const { studentId, password, nickname } = registerDto;

    // 检查学号是否已存在
    const existingUser = await this.prisma.user.findUnique({
      where: { studentId },
    });

    if (existingUser) {
      throw new ConflictException('该学号已被注册');
    }

    // 对密码进行加密
    // bcrypt.hash的第二个参数是"盐轮次",10是推荐值
    // 轮次越高越安全,但加密速度越慢
    const hashedPassword = await bcrypt.hash(password, 10);

    // 创建用户
    const user = await this.prisma.user.create({
      data: {
        studentId,
        password: hashedPassword,
        nickname,
      },
      // select指定返回哪些字段,避免返回密码
      select: {
        id: true,
        studentId: true,
        nickname: true,
        avatar: true,
        phone: true,
        campus: true,
        creditScore: true,
        createdAt: true,
      },
    });

    // 生成JWT Token
    const token = this.generateToken(user.id, user.studentId);

    return {
      user,
      accessToken: token,
    };
  }

  /**
   * 用户登录
   * 验证学号和密码,返回JWT Token
   *
   * @param loginDto - 登录信息(学号、密码)
   * @returns 用户信息和访问令牌
   * @throws UnauthorizedException 学号不存在或密码错误时抛出
   */
  async login(loginDto: LoginDto) {
    const { studentId, password } = loginDto;

    // 根据学号查找用户
    const user = await this.prisma.user.findUnique({
      where: { studentId },
    });

    if (!user) {
      // 为了安全,不区分"用户不存在"和"密码错误"
      throw new UnauthorizedException('学号或密码错误');
    }

    // 验证密码
    // bcrypt.compare会自动从哈希值中提取盐值进行比对
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('学号或密码错误');
    }

    // 生成JWT Token
    const token = this.generateToken(user.id, user.studentId);

    // 返回用户信息(排除密码)
    const { password: _, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      accessToken: token,
    };
  }

  /**
   * 修改密码
   *
   * @param userId - 当前登录用户的ID
   * @param changePasswordDto - 密码修改信息(旧密码、新密码)
   * @throws UnauthorizedException 旧密码错误时抛出
   */
  async changePassword(userId: number, changePasswordDto: ChangePasswordDto) {
    const { oldPassword, newPassword } = changePasswordDto;

    // 获取用户当前密码
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { password: true },
    });

    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }

    // 验证旧密码
    const isOldPasswordValid = await bcrypt.compare(oldPassword, user.password);

    if (!isOldPasswordValid) {
      throw new UnauthorizedException('旧密码错误');
    }

    // 加密新密码并更新
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);

    await this.prisma.user.update({
      where: { id: userId },
      data: { password: hashedNewPassword },
    });

    return { message: '密码修改成功' };
  }

  /**
   * 刷新Token
   * 为已登录用户生成新的访问令牌
   *
   * @param userId - 用户ID
   * @param studentId - 学号
   * @returns 新的访问令牌
   */
  async refreshToken(userId: number, studentId: string) {
    const token = this.generateToken(userId, studentId);
    return { accessToken: token };
  }

  /**
   * 根据ID查找用户
   * 用于JWT策略验证时获取用户信息
   *
   * @param userId - 用户ID
   * @returns 用户信息(不含密码)
   */
  async findUserById(userId: number) {
    return this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        studentId: true,
        nickname: true,
        avatar: true,
        phone: true,
        campus: true,
        creditScore: true,
        createdAt: true,
      },
    });
  }

  /**
   * 生成JWT Token
   * 私有方法,用于创建访问令牌
   *
   * @param userId - 用户ID
   * @param studentId - 学号
   * @returns JWT Token字符串
   */
  private generateToken(userId: number, studentId: string): string {
    // 构造JWT载荷
    const payload: JwtPayload = {
      sub: userId,
      studentId,
    };

    // 使用JwtService签发Token
    return this.jwtService.sign(payload);
  }
}
