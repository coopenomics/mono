import { SupportTicketAttachmentDomainEntity } from '../../domain/entities/support-ticket-attachment.entity';
import { SupportTicketAttachmentTypeormEntity } from '../entities/support-ticket-attachment.typeorm-entity';

export class SupportTicketAttachmentMapper {
  static toDomain(entity: SupportTicketAttachmentTypeormEntity): SupportTicketAttachmentDomainEntity {
    return {
      id: entity.id,
      ticketId: entity.ticketId,
      messageId: entity.messageId,
      storageKey: entity.storageKey,
      originalFilename: entity.originalFilename,
      mimeType: entity.mimeType,
      sizeBytes: entity.sizeBytes,
      checksumSha256: entity.checksumSha256,
      uploadedByUsername: entity.uploadedByUsername,
      uploadedAt: entity.uploadedAt,
    };
  }

  static toEntity(
    domain: Omit<SupportTicketAttachmentDomainEntity, 'id' | 'uploadedAt'>
  ): Partial<SupportTicketAttachmentTypeormEntity> {
    return {
      ticketId: domain.ticketId,
      messageId: domain.messageId,
      storageKey: domain.storageKey,
      originalFilename: domain.originalFilename,
      mimeType: domain.mimeType,
      sizeBytes: domain.sizeBytes,
      checksumSha256: domain.checksumSha256,
      uploadedByUsername: domain.uploadedByUsername,
    };
  }
}
