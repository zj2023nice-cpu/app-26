/**
 * 消息模块DTO
 */

import { IsString, IsNotEmpty, IsNumber, MaxLength } from 'class-validator';
import { Type } from 'class-transformer';

/**
 * 发送私信DTO
 */
export class SendMessageDto {
  /**
   * 接收者ID
   */
  @IsNotEmpty({ message: '接收者ID不能为空' })
  @Type(() => Number)
  @IsNumber({}, { message: '接收者ID必须是数字' })
  receiverId: number;

  /**
   * 消息内容
   */
  @IsNotEmpty({ message: '消息内容不能为空' })
  @IsString({ message: '消息内容必须是字符串' })
  @MaxLength(1000, { message: '消息内容最多1000个字符' })
  content: string;
}
