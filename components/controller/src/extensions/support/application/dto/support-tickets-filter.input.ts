import { Field, InputType } from '@nestjs/graphql';
import { IsArray, IsBoolean, IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { SupportTicketStatus } from '../../domain/enums/support-ticket-status.enum';
import { SupportTicketKind } from '../../domain/enums/support-ticket-kind.enum';
import { SupportTicketPriority } from '../../domain/enums/support-ticket-priority.enum';

/**
 * Фильтр очереди обращений.
 *
 * Все поля необязательны: пустой фильтр даёт все обращения кооператива.
 * Кооператив аргументом не принимается ни здесь, ни в самой операции —
 * область видимости задаёт сервер.
 */
@InputType('SupportTicketsFilterInput')
export class SupportTicketsFilterInputDTO {
  @Field(() => [SupportTicketStatus], {
    nullable: true,
    description: 'Статусы обращений. Набор, а не одно значение: закладка «активные» — это новые и в работе вместе.',
  })
  @IsOptional()
  @IsArray()
  @IsEnum(SupportTicketStatus, { each: true })
  statuses?: SupportTicketStatus[];

  @Field(() => SupportTicketKind, { nullable: true, description: 'Вид обращения.' })
  @IsOptional()
  @IsEnum(SupportTicketKind)
  kind?: SupportTicketKind;

  @Field(() => SupportTicketPriority, { nullable: true, description: 'Приоритет обращения.' })
  @IsOptional()
  @IsEnum(SupportTicketPriority)
  priority?: SupportTicketPriority;

  @Field(() => String, { nullable: true, description: 'Член совета, взявший обращение в работу.' })
  @IsOptional()
  @IsString()
  assignee_username?: string;

  @Field(() => Boolean, {
    nullable: true,
    description: 'Только эскалированные обращения либо, наоборот, только неэскалированные.',
  })
  @IsOptional()
  @IsBoolean()
  escalated?: boolean;

  @Field(() => String, {
    nullable: true,
    description: 'Автор обращения. Так же смотрят историю общения с конкретным пайщиком.',
  })
  @IsOptional()
  @IsString()
  author_username?: string;

  @Field(() => String, {
    nullable: true,
    description: 'Поиск по теме обращения: подстрока без учёта регистра. По текстам переписки поиска нет.',
  })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  subject_contains?: string;
}
