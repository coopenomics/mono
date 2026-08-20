import type { PaginationInputDTO, PaginationResult } from '@coopenomics/extension-kit';
import { SupportTicketDomainEntity } from '../entities/support-ticket.entity';
import { SupportTicketStatus } from '../enums/support-ticket-status.enum';
import { SupportTicketKind } from '../enums/support-ticket-kind.enum';

export interface SupportTicketRepository {
  create(
    data: Omit<SupportTicketDomainEntity, 'id' | 'number' | 'createdAt' | 'updatedAt'>
  ): Promise<SupportTicketDomainEntity>;

  findById(id: string): Promise<SupportTicketDomainEntity | null>;

  findByNumber(number: string): Promise<SupportTicketDomainEntity | null>;

  /** Очередь оператора: обращения выбранных статусов, свежие сверху — индекс (status, last_message_at). */
  findByStatuses(
    statuses: SupportTicketStatus[],
    options?: PaginationInputDTO
  ): Promise<PaginationResult<SupportTicketDomainEntity>>;

  /** «Мои обращения» у пайщика — индекс (author_username, created_at). */
  findByAuthor(
    authorUsername: string,
    options?: PaginationInputDTO
  ): Promise<PaginationResult<SupportTicketDomainEntity>>;

  /** «Взятые мной» у оператора — индекс (assignee_username, status). */
  findByAssignee(
    assigneeUsername: string,
    statuses?: SupportTicketStatus[],
    options?: PaginationInputDTO
  ): Promise<PaginationResult<SupportTicketDomainEntity>>;

  /** Фильтр по виду обращения — индекс (kind, status). */
  findByKind(
    kind: SupportTicketKind,
    statuses?: SupportTicketStatus[],
    options?: PaginationInputDTO
  ): Promise<PaginationResult<SupportTicketDomainEntity>>;

  /** Обращения в статусе RESOLVED с resolved_at не позже cutoff — под задачу автозакрытия, частичный индекс (resolved_at). */
  findResolvedBefore(cutoff: Date): Promise<SupportTicketDomainEntity[]>;

  /** Эскалированные обращения — частичный индекс (escalated_at). */
  findEscalated(options?: PaginationInputDTO): Promise<PaginationResult<SupportTicketDomainEntity>>;

  update(
    id: string,
    changes: Partial<
      Omit<SupportTicketDomainEntity, 'id' | 'number' | 'coopname' | 'authorUsername' | 'createdAt'>
    >
  ): Promise<SupportTicketDomainEntity>;
}

export const SUPPORT_TICKET_REPOSITORY = Symbol('SupportTicketRepository');
