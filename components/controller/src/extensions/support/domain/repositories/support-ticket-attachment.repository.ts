import type { PaginationInputDTO, PaginationResult } from '@coopenomics/extension-kit';
import { SupportTicketAttachmentDomainEntity } from '../entities/support-ticket-attachment.entity';

export interface SupportTicketAttachmentRepository {
  create(
    data: Omit<SupportTicketAttachmentDomainEntity, 'id' | 'uploadedAt'>
  ): Promise<SupportTicketAttachmentDomainEntity>;

  findById(id: string): Promise<SupportTicketAttachmentDomainEntity | null>;

  /** Файлы конкретного сообщения при отрисовке ленты — индекс (message_id). */
  findByMessageId(messageId: string): Promise<SupportTicketAttachmentDomainEntity[]>;

  /**
   * Файлы сразу для страницы ленты — тот же индекс (message_id).
   *
   * Батчем, а не вызовом {@link findByMessageId} на каждую запись: страница
   * из двадцати сообщений иначе даёт двадцать отдельных запросов. Сообщения
   * без вложений в ответе отсутствуют.
   */
  findByMessageIds(messageIds: string[]): Promise<Map<string, SupportTicketAttachmentDomainEntity[]>>;

  /** Все файлы обращения одним списком — индекс (ticket_id, uploaded_at). */
  findByTicketId(
    ticketId: string,
    options?: PaginationInputDTO
  ): Promise<PaginationResult<SupportTicketAttachmentDomainEntity>>;

  /**
   * Из переданных обращений — те, у которых есть хотя бы одно вложение.
   *
   * Строке списка нужен признак, а не список файлов, поэтому наружу идут
   * только идентификаторы. Батчем на всю страницу по той же причине, что и
   * счётчик сообщений: запрос на строку превратил бы список в двадцать
   * запросов.
   */
  findTicketIdsWithAttachments(ticketIds: string[]): Promise<Set<string>>;

  /** Защита от двойной загрузки одного файла в одно обращение — unique (ticket_id, checksum_sha256). */
  findByTicketAndChecksum(
    ticketId: string,
    checksumSha256: string
  ): Promise<SupportTicketAttachmentDomainEntity | null>;
}

export const SUPPORT_TICKET_ATTACHMENT_REPOSITORY = Symbol('SupportTicketAttachmentRepository');
