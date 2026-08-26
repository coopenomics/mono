import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import {
  SupportTicketParticipantRepository,
  type SupportParticipantDraft,
} from '../../domain/repositories/support-ticket-participant.repository';
import { SupportTicketParticipantDomainEntity } from '../../domain/entities/support-ticket-participant.entity';
import { SupportTicketParticipantTypeormEntity } from '../entities/support-ticket-participant.typeorm-entity';
import { SupportTicketParticipantMapper } from '../mappers/support-ticket-participant.mapper';

@Injectable()
export class SupportTicketParticipantTypeormRepository implements SupportTicketParticipantRepository {
  constructor(
    @InjectRepository(SupportTicketParticipantTypeormEntity)
    private readonly repository: Repository<SupportTicketParticipantTypeormEntity>
  ) {}

  async addIfAbsent(
    ticketId: string,
    draft: SupportParticipantDraft
  ): Promise<SupportTicketParticipantDomainEntity | null> {
    // Вставка с «пропустить при конфликте» вместо «прочитать и вставить»:
    // между чтением и записью пролезал бы второй одновременный запрос, и
    // уникальность пары отвечала бы ему исключением вместо молчаливого
    // повтора. Здесь гонку разрешает сама схема, а команда узнаёт исход по
    // тому, появилась строка или нет.
    const result = await this.repository
      .createQueryBuilder()
      .insert()
      .into(SupportTicketParticipantTypeormEntity)
      .values(SupportTicketParticipantMapper.toEntity({ ...draft, ticketId }))
      .orIgnore()
      .returning('*')
      .execute();

    const inserted = result.raw?.[0];
    if (!inserted) return null;

    // `returning` отдаёт колонки базы, а не свойства сущности — раскладку
    // знает маппер, и только он.
    return SupportTicketParticipantMapper.fromRaw(inserted);
  }

  async remove(ticketId: string, participantUsername: string): Promise<boolean> {
    const result = await this.repository.delete({ ticketId, participantUsername });
    return Boolean(result.affected);
  }

  async findByTicketId(ticketId: string): Promise<SupportTicketParticipantDomainEntity[]> {
    const entities = await this.repository.find({
      where: { ticketId },
      order: { addedAt: 'ASC' },
    });
    return entities.map(SupportTicketParticipantMapper.toDomain);
  }

  async findUsernamesByTicketIds(ticketIds: string[]): Promise<Map<string, string[]>> {
    if (ticketIds.length === 0) return new Map();

    const entities = await this.repository.find({
      where: { ticketId: In(ticketIds) },
      order: { addedAt: 'ASC' },
    });

    const grouped = new Map<string, string[]>();
    for (const entity of entities) {
      const bucket = grouped.get(entity.ticketId);
      if (bucket) bucket.push(entity.participantUsername);
      else grouped.set(entity.ticketId, [entity.participantUsername]);
    }
    return grouped;
  }

  async findTicketIdsByParticipant(participantUsername: string): Promise<string[]> {
    const rows = await this.repository
      .createQueryBuilder('participant')
      .select('participant.ticketId', 'ticketId')
      .where('participant.participantUsername = :participantUsername', { participantUsername })
      .getRawMany<{ ticketId: string }>();

    return rows.map((row) => row.ticketId);
  }
}
