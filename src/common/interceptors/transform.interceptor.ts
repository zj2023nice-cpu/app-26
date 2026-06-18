/**
 * 响应转换拦截器
 * ============================================================================
 * 拦截器用于在请求处理前后添加额外的逻辑
 * TransformInterceptor将所有成功响应包装为统一的格式
 *
 * 标准成功响应格式:
 * {
 *   "code": 200,           // HTTP状态码
 *   "message": "success",  // 成功标识
 *   "data": { ... }        // 实际返回的数据
 * }
 *
 * 这样做的好处:
 * 1. 前端可以统一处理响应,通过code判断成功/失败
 * 2. 响应格式一致,便于前后端协作
 * 3. 所有控制器方法只需返回数据,不用关心包装格式
 * ============================================================================
 */

import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

/**
 * 标准响应接口
 * 定义统一的响应数据结构
 */
export interface Response<T> {
  code: number; // 状态码
  message: string; // 消息
  data: T; // 数据
}

/**
 * 响应转换拦截器
 * 使用泛型T表示data字段可以是任意类型
 */
@Injectable()
export class TransformInterceptor<T>
  implements NestInterceptor<T, Response<T>>
{
  /**
   * 拦截方法
   * @param context - 执行上下文
   * @param next - 调用链中的下一个处理器
   * @returns Observable<Response<T>> - 包装后的响应
   */
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<Response<T>> {
    // next.handle() 返回一个Observable,代表控制器方法的返回值
    // 使用RxJS的map操作符对返回值进行转换
    return next.handle().pipe(
      map((data) => ({
        code: 200, // 统一使用200表示成功
        message: 'success',
        data: data, // 控制器方法的原始返回值
      })),
    );
  }
}
