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
}

export const SUPPORT_TICKET_MESSAGE_REPOSITORY = Symbol('SupportTicketMessageRepository');
