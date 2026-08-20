import { SupportTicketMessageDomainEntity } from '../../domain/entities/support-ticket-message.entity';
import { SupportTicketMessageTypeormEntity } from '../entities/support-ticket-message.typeorm-entity';

export class SupportTicketMessageMapper {
  static toDomain(entity: SupportTicketMessageTypeormEntity): SupportTicketMessageDomainEntity {
    return {
      id: entity.id,
      ticketId: entity.ticketId,
      authorUsername: entity.authorUsername,
      authorRole: entity.authorRole,
      body: entity.body,
      systemEvent: entity.systemEvent,
      payload: entity.payload,
      createdAt: entity.createdAt,
    };
  }

  static toEntity(
    domain: Omit<SupportTicketMessageDomainEntity, 'id' | 'createdAt'>
  ): Partial<SupportTicketMessageTypeormEntity> {
    return {
      ticketId: domain.ticketId,
      authorUsername: domain.authorUsername,
      authorRole: domain.authorRole,
      body: domain.body,
      systemEvent: domain.systemEvent,
      payload: domain.payload,
    };
  }
}
