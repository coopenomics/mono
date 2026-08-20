import { SupportTicketDomainEntity } from '../../domain/entities/support-ticket.entity';
import { SupportTicketTypeormEntity } from '../entities/support-ticket.typeorm-entity';

export class SupportTicketMapper {
  static toDomain(entity: SupportTicketTypeormEntity): SupportTicketDomainEntity {
    return {
      id: entity.id,
      number: entity.number,
      coopname: entity.coopname,
      kind: entity.kind,
      status: entity.status,
      priority: entity.priority,
      subject: entity.subject,
      authorUsername: entity.authorUsername,
      assigneeUsername: entity.assigneeUsername,
      responsibilityZone: entity.responsibilityZone,
      lastMessageAt: entity.lastMessageAt,
      resolvedAt: entity.resolvedAt,
      escalatedAt: entity.escalatedAt,
      reopenCount: entity.reopenCount,
      createdAt: entity.createdAt,
      updatedAt: entity.updatedAt,
    };
  }

  static toEntity(
    domain: Omit<SupportTicketDomainEntity, 'id' | 'number' | 'createdAt' | 'updatedAt'>
  ): Partial<SupportTicketTypeormEntity> {
    return {
      coopname: domain.coopname,
      kind: domain.kind,
      status: domain.status,
      priority: domain.priority,
      subject: domain.subject,
      authorUsername: domain.authorUsername,
      assigneeUsername: domain.assigneeUsername,
      responsibilityZone: domain.responsibilityZone,
      lastMessageAt: domain.lastMessageAt,
      resolvedAt: domain.resolvedAt,
      escalatedAt: domain.escalatedAt,
      reopenCount: domain.reopenCount,
    };
  }
}
