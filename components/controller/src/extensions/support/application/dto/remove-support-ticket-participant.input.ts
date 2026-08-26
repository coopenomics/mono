import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

/**
 * Вход `removeSupportTicketParticipant` — отключить участника от обращения.
 *
 * Отключение снимает подписку, а не доступ: член совета по-прежнему может
 * открыть обращение и ответить в нём. Меняется только то, что он перестаёт
 * получать уведомления и обращение уходит из его очереди «где я участвую».
 */
@InputType('RemoveSupportTicketParticipantInput')
export class RemoveSupportTicketParticipantInputDTO {
  @Field(() => String, { description: 'Идентификатор обращения.' })
  @IsUUID('4')
  ticket_id!: string;

  @Field(() => String, { description: 'Участник, отключаемый от обращения.' })
  @IsNotEmpty()
  @IsString()
  participant_username!: string;
}
