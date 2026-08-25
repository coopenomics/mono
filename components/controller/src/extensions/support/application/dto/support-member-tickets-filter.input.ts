import { Field, InputType } from '@nestjs/graphql';
import { IsArray, IsEnum, IsOptional } from 'class-validator';
import { SupportTicketStatus } from '../../domain/enums/support-ticket-status.enum';
import { SupportTicketKind } from '../../domain/enums/support-ticket-kind.enum';

/**
 * Фильтр списка «мои обращения» — беднее очереди совета.
 *
 * Приоритет и оператор пайщику как фильтр не нужны, а **имени пайщика здесь
 * нет и быть не должно**: автор подставляется из текущего пользователя. Не
 * скрытым полем, а структурно — передать чужое имя просто некуда. Совет
 * смотрит чужие обращения через очередь с фильтром по автору: один способ
 * вместо двух.
 */
@InputType('SupportMemberTicketsFilterInput')
export class SupportMemberTicketsFilterInputDTO {
  @Field(() => [SupportTicketStatus], {
    nullable: true,
    description: 'Статусы обращений. Набор, а не одно значение.',
  })
  @IsOptional()
  @IsArray()
  @IsEnum(SupportTicketStatus, { each: true })
  statuses?: SupportTicketStatus[];

  @Field(() => SupportTicketKind, { nullable: true, description: 'Вид обращения.' })
  @IsOptional()
  @IsEnum(SupportTicketKind)
  kind?: SupportTicketKind;
}
