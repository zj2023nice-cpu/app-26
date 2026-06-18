/**
 * JWT认证守卫
 * ============================================================================
 * 守卫(Guard)是NestJS中用于控制访问权限的组件
 * JwtAuthGuard负责验证请求中的JWT Token,确保用户已登录
 *
 * 工作流程:
 * 1. 检查接口是否被@Public()标记为公开
 * 2. 如果是公开接口,直接放行
 * 3. 如果不是,调用Passport的JWT策略验证Token
 * 4. Token有效则放行,无效则返回401错误
 * ============================================================================
 */

import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * JWT认证守卫类
 * 继承自AuthGuard('jwt'),使用Passport的JWT策略
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  /**
   * 构造函数
   * @param reflector - 反射器,用于读取装饰器设置的元数据
   */
  constructor(private reflector: Reflector) {
    super();
  }

  /**
   * 决定是否允许请求通过
   * @param context - 执行上下文,包含请求信息和处理器信息
   * @returns true表示允许通过,false表示拒绝
   */
  canActivate(context: ExecutionContext) {
    // 使用反射器读取处理器上的@Public()装饰器
    // getAllAndOverride会从方法和类两个级别查找元数据
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(), // 方法级别的装饰器
      context.getClass(), // 类级别的装饰器
    ]);

    // 如果接口被标记为公开,直接放行,不需要验证Token
    if (isPublic) {
      return true;
    }

    // 否则调用父类的canActivate方法,执行JWT验证
    // 这会触发JwtStrategy的validate方法
    return super.canActivate(context);
  }
}
