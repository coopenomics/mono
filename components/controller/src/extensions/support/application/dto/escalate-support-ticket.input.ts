import { Field, InputType } from '@nestjs/graphql';
import { IsOptional, IsString, IsUUID } from 'class-validator';

/**
 * Вход `escalateSupportTicket` — перевести обращение на председателя.
 *
 * `reason` — внутренняя записка совета: наружу автору обращения она не
 * показывается ни при каких обстоятельствах (слой видимости просеивает её
 * из деталей системного события).
 */
@InputType('EscalateSupportTicketInput')
export class EscalateSupportTicketInputDTO {
  @Field(() => String, { description: 'Идентификатор обращения.' })
  @IsUUID('4')
  ticket_id!: string;

  @Field(() => String, { nullable: true, description: 'Причина эскалации — внутренняя записка совета, автору обращения не показывается.' })
  @IsOptional()
  @IsString()
  reason?: string;
}
