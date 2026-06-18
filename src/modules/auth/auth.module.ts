/**
 * 认证模块
 * ============================================================================
 * AuthModule整合了所有认证相关的组件:
 * - AuthController: 处理HTTP请求
 * - AuthService: 业务逻辑
 * - JwtStrategy: JWT验证策略
 * - JwtModule: JWT服务配置
 *
 * 这个模块负责用户的登录、注册、Token管理等功能
 * ============================================================================
 */

import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';

@Module({
  imports: [
    // Passport模块 - 提供认证框架
    PassportModule,

    // JWT模块 - 配置JWT签发参数
    // 使用registerAsync进行异步配置,以便从ConfigService获取环境变量
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        // JWT签名密钥,从环境变量读取
        secret: configService.get<string>('JWT_SECRET'),
        // Token配置
        signOptions: {
          // 过期时间,从环境变量读取,默认7天
          expiresIn: configService.get<string>('JWT_EXPIRES_IN', '7d'),
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, JwtStrategy],
  // 导出AuthService,以便其他模块可以使用认证功能
  exports: [AuthService],
})
export class AuthModule {}
