import { Field, InputType } from '@nestjs/graphql';
import { IsOptional, IsString, IsUUID } from 'class-validator';

/**
 * Вход `resolveSupportTicket` — пометить обращение решённым и запустить
 * отсчёт автозакрытия.
 *
 * `comment` необязателен: если он есть, в ленте появляются две записи одной
 * транзакцией (сообщение оператора и системная отметка о решении), а
 * уведомление уходит одно — о смене статуса (спецификация, раздел 3).
 */
@InputType('ResolveSupportTicketInput')
export class ResolveSupportTicketInputDTO {
  @Field(() => String, { description: 'Идентификатор обращения.' })
  @IsUUID('4')
  ticket_id!: string;

  @Field(() => String, { nullable: true, description: 'Комментарий оператора к решению — необязателен.' })
  @IsOptional()
  @IsString()
  comment?: string;
}
