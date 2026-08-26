import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

/**
 * Вход `addSupportTicketParticipant` — подключить члена совета к обращению.
 *
 * Подключение не расширяет прав: совет и без него читает любое обращение
 * кооператива и пишет в любое. Оно решает две другие задачи — подключённый
 * получает уведомления по обращению и видит его в своей очереди.
 *
 * Поле называется `participant_username`, а не `username`: у `RolesGuard` есть
 * послабление для операций, где пайщик действует за себя (совпадение
 * `data.username` с именем текущего пользователя), и здесь оно не годится ни
 * по названию, ни по смыслу. Роль проверяется явно в коде сервиса.
 */
@InputType('AddSupportTicketParticipantInput')
export class AddSupportTicketParticipantInputDTO {
  @Field(() => String, { description: 'Идентификатор обращения.' })
  @IsUUID('4')
  ticket_id!: string;

  @Field(() => String, { description: 'Член совета, подключаемый к обращению.' })
  @IsNotEmpty()
  @IsString()
  participant_username!: string;
}
