import { Field, InputType } from '@nestjs/graphql';
import { IsArray, IsNotEmpty, IsOptional, IsString, IsUUID, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { SupportAttachmentInputDTO } from './support-attachment.input';

/**
 * Вход `replySupportTicket`.
 *
 * Автор сообщения не принимается аргументом — подставляется из актора.
 * Кто пишет — автор обращения или член совета — решает сервис по совпадению
 * имени актора с автором обращения, а не поле входа.
 */
@InputType('ReplySupportTicketInput')
export class ReplySupportTicketInputDTO {
  @Field(() => String, { description: 'Идентификатор обращения.' })
  @IsUUID('4')
  ticket_id!: string;

  @Field(() => String, { description: 'Текст сообщения.' })
  @IsNotEmpty()
  @IsString()
  body!: string;

  @Field(() => [SupportAttachmentInputDTO], { nullable: true, description: 'Файлы, приложенные к сообщению.' })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SupportAttachmentInputDTO)
  attachments?: SupportAttachmentInputDTO[];
}
