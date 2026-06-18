/**
 * 当前用户装饰器
 * ============================================================================
 * 在需要认证的接口中,经常需要获取当前登录用户的信息
 * 这个装饰器简化了从请求对象中获取用户信息的过程
 *
 * 使用示例:
 * ```typescript
 * @Get('profile')
 * getProfile(@CurrentUser() user: User) {
 *   return user;
 * }
 *
 * // 只获取用户ID
 * @Get('my-items')
 * getMyItems(@CurrentUser('id') userId: number) {
 *   return this.itemService.findByUserId(userId);
 * }
 * ```
 * ============================================================================
 */

import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * CurrentUser参数装饰器
 * 从HTTP请求对象中提取用户信息
 *
 * @param data - 可选参数,指定要提取的用户属性名
 *               如果不传,返回整个用户对象
 *               如果传了属性名(如'id'),只返回该属性的值
 * @param ctx - 执行上下文,包含请求对象等信息
 */
export const CurrentUser = createParamDecorator(
  (data: string | undefined, ctx: ExecutionContext) => {
    // 获取HTTP请求对象
    const request = ctx.switchToHttp().getRequest();

    // request.user 是由JwtAuthGuard解析JWT后附加到请求对象上的
    const user = request.user;

    // 如果指定了属性名,返回该属性;否则返回整个用户对象
    return data ? user?.[data] : user;
  },
);
