import { Field, InputType } from '@nestjs/graphql';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';

/**
 * Вход `assignSupportTicket` — взять обращение в работу или переназначить
 * оператора.
 *
 * Поле называется `assignee_username`, а не `username`: у `RolesGuard` есть
 * послабление для операций, где пайщик действует за себя (совпадение
 * `data.username` с именем текущего пользователя). Здесь оно не годится ни
 * по названию поля, ни по смыслу — назначаемый оператор не обязан быть
 * автором запроса, — поэтому проверка роли сделана явно в коде сервиса
 * (`SupportCommandsService.assertCouncil`), а не оставлена одному декоратору.
 */
@InputType('AssignSupportTicketInput')
export class AssignSupportTicketInputDTO {
  @Field(() => String, { description: 'Идентификатор обращения.' })
  @IsUUID('4')
  ticket_id!: string;

  @Field(() => String, { description: 'Член совета, назначаемый оператором обращения.' })
  @IsNotEmpty()
  @IsString()
  assignee_username!: string;
}
