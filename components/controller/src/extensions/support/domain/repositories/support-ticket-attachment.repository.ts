import type { PaginationInputDTO, PaginationResult } from '@coopenomics/extension-kit';
import { SupportTicketAttachmentDomainEntity } from '../entities/support-ticket-attachment.entity';

export interface SupportTicketAttachmentRepository {
  create(
    data: Omit<SupportTicketAttachmentDomainEntity, 'id' | 'uploadedAt'>
  ): Promise<SupportTicketAttachmentDomainEntity>;

  findById(id: string): Promise<SupportTicketAttachmentDomainEntity | null>;

  /** Файлы конкретного сообщения при отрисовке ленты — индекс (message_id). */
  findByMessageId(messageId: string): Promise<SupportTicketAttachmentDomainEntity[]>;

  /** Все файлы обращения одним списком — индекс (ticket_id, uploaded_at). */
  findByTicketId(
    ticketId: string,
    options?: PaginationInputDTO
  ): Promise<PaginationResult<SupportTicketAttachmentDomainEntity>>;

  /** Защита от двойной загрузки одного файла в одно обращение — unique (ticket_id, checksum_sha256). */
  findByTicketAndChecksum(
    ticketId: string,
    checksumSha256: string
  ): Promise<SupportTicketAttachmentDomainEntity | null>;
}

export const SUPPORT_TICKET_ATTACHMENT_REPOSITORY = Symbol('SupportTicketAttachmentRepository');
