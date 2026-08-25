import type { PaginationInputDTO, PaginationResult } from '@coopenomics/extension-kit';
import { SupportTicketMessageDomainEntity } from '../entities/support-ticket-message.entity';

export interface SupportTicketMessageRepository {
  /**
   * Лента только дописывается — редактирования задним числом нет, поэтому
   * метода обновления в интерфейсе нет вовсе (модель, раздел 4).
   */
  append(
    data: Omit<SupportTicketMessageDomainEntity, 'id' | 'createdAt'>
  ): Promise<SupportTicketMessageDomainEntity>;

  findById(id: string): Promise<SupportTicketMessageDomainEntity | null>;

  /** Хронология переписки обращения — индекс (ticket_id, created_at). */
  findByTicketId(
    ticketId: string,
    options?: PaginationInputDTO
  ): Promise<PaginationResult<SupportTicketMessageDomainEntity>>;

  /**
   * Число записей ленты для каждого из переданных обращений — под счётчик в
   * строке списка.
   *
   * Батчем на всю страницу, а не по обращению: иначе список из двадцати строк
   * превращается в двадцать отдельных запросов. Обращения без записей в ответе
   * отсутствуют — вызывающий подставляет ноль.
   */
  countByTicketIds(ticketIds: string[]): Promise<Map<string, number>>;
}

export const SUPPORT_TICKET_MESSAGE_REPOSITORY = Symbol('SupportTicketMessageRepository');
