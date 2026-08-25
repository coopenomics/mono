import { Field, Int, ObjectType } from '@nestjs/graphql';
import { SupportTicketStatus } from '../../domain/enums/support-ticket-status.enum';
import type { SupportQueueSummaryView } from '../services/support-queries.types';

/**
 * Счётчики закладок очереди совета.
 *
 * Это счётчики статусов, а не непрочитанного: отметок о прочтении в модели нет
 * намеренно. Нули присутствуют — закладка с нулём должна показывать ноль, а не
 * исчезать.
 *
 * Поля перечислены явно, а не отданы списком пар «статус — число»: набор
 * статусов фиксирован перечислением, и список пар заставил бы интерфейс искать
 * нужный статус в массиве вместо обращения к полю.
 */
@ObjectType('SupportQueueSummary', { description: 'Сколько обращений в каждом статусе.' })
export class SupportQueueSummaryOutputDTO {
  @Field(() => Int, { description: 'Новые обращения, которые ещё никто не взял в работу.' })
  new!: number;

  @Field(() => Int, { description: 'Обращения в работе.' })
  in_progress!: number;

  @Field(() => Int, { description: 'Обращения, помеченные решёнными и ожидающие автоматического закрытия.' })
  resolved!: number;

  @Field(() => Int, { description: 'Закрытые обращения.' })
  closed!: number;

  static fromView(view: SupportQueueSummaryView): SupportQueueSummaryOutputDTO {
    const dto = new SupportQueueSummaryOutputDTO();
    dto.new = view[SupportTicketStatus.NEW];
    dto.in_progress = view[SupportTicketStatus.IN_PROGRESS];
    dto.resolved = view[SupportTicketStatus.RESOLVED];
    dto.closed = view[SupportTicketStatus.CLOSED];
    return dto;
  }
}
