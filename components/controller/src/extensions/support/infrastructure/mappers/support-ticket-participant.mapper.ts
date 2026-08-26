import { SupportTicketParticipantDomainEntity } from '../../domain/entities/support-ticket-participant.entity';
import { SupportTicketParticipantTypeormEntity } from '../entities/support-ticket-participant.typeorm-entity';

/**
 * Строка подключения, как её отдаёт `returning('*')`.
 *
 * Это не сущность ORM: `returning` возвращает колонки базы под их
 * собственными именами (`ticket_id`, а не `ticketId`), и раскладку колонок
 * знает только маппер.
 */
export interface SupportTicketParticipantRawRow {
  id: string;
  ticket_id: string;
  participant_username: string;
  added_by_username: string;
  added_at: Date;
}

export class SupportTicketParticipantMapper {
  static toDomain(
    entity: SupportTicketParticipantTypeormEntity
  ): SupportTicketParticipantDomainEntity {
    return {
      id: entity.id,
      ticketId: entity.ticketId,
      participantUsername: entity.participantUsername,
      addedByUsername: entity.addedByUsername,
      addedAt: entity.addedAt,
    };
  }

  /**
   * Сырая строка `returning('*')` → доменная сущность.
   *
   * Нужен потому, что подключение вставляется через query builder с
   * «пропустить при конфликте», а такая вставка отдаёт не сущность ORM, а
   * колонки базы. Соответствие имён живёт здесь, рядом с двумя остальными
   * направлениями: знай его ещё и репозитории, при первом же новом поле они
   * разошлись бы с маппером молча.
   */
  static fromRaw(row: SupportTicketParticipantRawRow): SupportTicketParticipantDomainEntity {
    return {
      id: row.id,
      ticketId: row.ticket_id,
      participantUsername: row.participant_username,
      addedByUsername: row.added_by_username,
      addedAt: row.added_at,
    };
  }

  static toEntity(
    domain: Omit<SupportTicketParticipantDomainEntity, 'id' | 'addedAt'>
  ): Partial<SupportTicketParticipantTypeormEntity> {
    return {
      ticketId: domain.ticketId,
      participantUsername: domain.participantUsername,
      addedByUsername: domain.addedByUsername,
    };
  }
}
