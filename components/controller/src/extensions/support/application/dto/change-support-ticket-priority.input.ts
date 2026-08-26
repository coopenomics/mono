import { Field, InputType } from '@nestjs/graphql';
import { IsEnum, IsUUID } from 'class-validator';
import { SupportTicketPriority } from '../../domain/enums/support-ticket-priority.enum';

/** Вход `changeSupportTicketPriority` — менять приоритет может только совет. */
@InputType('ChangeSupportTicketPriorityInput')
export class ChangeSupportTicketPriorityInputDTO {
  @Field(() => String, { description: 'Идентификатор обращения.' })
  @IsUUID('4')
  ticket_id!: string;

  @Field(() => SupportTicketPriority, { description: 'Новый приоритет обращения.' })
  @IsEnum(SupportTicketPriority)
  priority!: SupportTicketPriority;
}
