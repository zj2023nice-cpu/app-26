/**
 * JWT策略
 * ============================================================================
 * JwtStrategy定义了如何验证JWT Token
 * 当请求携带JWT时,Passport会自动调用这个策略来验证Token
 *
 * 验证流程:
 * 1. 从请求头的Authorization字段提取Bearer Token
 * 2. 使用密钥验证Token签名
 * 3. 检查Token是否过期
 * 4. 调用validate方法获取用户信息
 * 5. 将用户信息附加到request.user
 * ============================================================================
 */

import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { ConfigService } from '@nestjs/config';
import { AuthService, JwtPayload } from './auth.service';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  /**
   * 构造函数
   * 配置JWT验证参数
   *
   * @param configService - 配置服务,用于获取JWT密钥
   * @param authService - 认证服务,用于查询用户信息
   */
  constructor(
    private configService: ConfigService,
    private authService: AuthService,
  ) {
    // 调用父类构造函数,传入JWT配置
    super({
      // 指定如何从请求中提取JWT
      // fromAuthHeaderAsBearerToken: 从Authorization头的Bearer Token中提取
      // 格式: Authorization: Bearer <token>
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),

      // 是否忽略Token过期
      // false表示不忽略,过期的Token会被拒绝
      ignoreExpiration: false,

      // JWT签名密钥,必须与签发Token时使用的密钥一致
      secretOrKey: configService.get<string>('JWT_SECRET'),
    });
  }

  /**
   * 验证回调方法
   * 当JWT签名验证通过后,Passport会调用这个方法
   * 返回的对象会被附加到request.user
   *
   * @param payload - JWT载荷,包含用户ID和学号
   * @returns 用户信息对象,会被设置到request.user
   * @throws UnauthorizedException 用户不存在时抛出
   */
  async validate(payload: JwtPayload) {
    // 根据JWT中的用户ID查询用户信息
    const user = await this.authService.findUserById(payload.sub);

    if (!user) {
      throw new UnauthorizedException('用户不存在或已被禁用');
    }

    // 返回的对象会被Passport设置到request.user
    // 这样在Controller中就可以通过@CurrentUser()装饰器获取
    return user;
  }
}
