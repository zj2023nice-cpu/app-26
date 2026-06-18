/**
 * HTTP异常过滤器
 * ============================================================================
 * 异常过滤器用于统一处理应用中抛出的所有HTTP异常
 * 它将各种异常转换为标准化的JSON响应格式
 *
 * 标准错误响应格式:
 * {
 *   "code": 400,           // HTTP状态码
 *   "message": "错误信息",  // 错误描述
 *   "timestamp": "2024-01-19T12:00:00.000Z"  // 时间戳
 * }
 *
 * 这样做的好处:
 * 1. 前端可以统一处理错误响应
 * 2. 错误信息格式一致,便于调试
 * 3. 隐藏敏感的内部错误细节
 * ============================================================================
 */

import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';

/**
 * @Catch(HttpException) - 指定这个过滤器捕获HttpException类型的异常
 * 也可以用@Catch()不带参数来捕获所有异常
 */
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  /**
   * 异常处理方法
   * 当捕获到HttpException时,NestJS会调用这个方法
   *
   * @param exception - 捕获到的异常对象
   * @param host - 参数宿主,用于获取请求和响应对象
   */
  catch(exception: HttpException, host: ArgumentsHost) {
    // 切换到HTTP上下文,获取响应对象
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    // 获取HTTP状态码
    const status = exception.getStatus();

    // 获取异常响应内容
    // NestJS的HttpException可能返回字符串或对象
    const exceptionResponse = exception.getResponse();

    // 提取错误消息
    // 如果是对象形式(如ValidationPipe的错误),提取message字段
    // 否则直接使用字符串
    let message: string | string[];
    if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      message = (exceptionResponse as any).message || exception.message;
    } else {
      message = exceptionResponse as string;
    }

    // 返回标准化的错误响应
    response.status(status).json({
      code: status,
      message: message,
      timestamp: new Date().toISOString(),
    });
  }
}

/**
 * 全局异常过滤器
 * ============================================================================
 * 这个过滤器捕获所有类型的异常,包括非HTTP异常(如数据库错误)
 * 它是最后一道防线,确保任何未处理的错误都能返回友好的响应
 * ============================================================================
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();

    // 判断是否为HTTP异常
    const isHttpException = exception instanceof HttpException;

    // 确定状态码:HTTP异常使用其状态码,其他异常统一使用500
    const status = isHttpException
      ? exception.getStatus()
      : HttpStatus.INTERNAL_SERVER_ERROR;

    // 确定错误消息:HTTP异常使用其消息,其他异常使用通用消息
    // 避免暴露内部错误细节给客户端
    const message = isHttpException
      ? exception.message
      : '服务器内部错误,请稍后重试';

    // 在控制台打印详细错误信息,方便开发调试
    console.error('❌ 异常捕获:', exception);

    // 返回标准化的错误响应
    response.status(status).json({
      code: status,
      message: message,
      timestamp: new Date().toISOString(),
    });
  }
}
