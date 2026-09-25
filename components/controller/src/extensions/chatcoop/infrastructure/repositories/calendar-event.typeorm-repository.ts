import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type {
  ChatCoopCalendarEventRepository,
} from '../../domain/repositories/calendar-event.repository';
import type {
  ChatCoopCalendarEventDomainEntity,
  CreateChatCoopCalendarEventDomainInput,
  UpdateChatCoopCalendarEventDomainInput,
} from '../../domain/entities/calendar-event.entity';
import { CalendarEventTypeormEntity } from '../entities/calendar-event.typeorm-entity';
import { ManagedMatrixRoomTypeormEntity } from '../entities/managed-matrix-room.typeorm-entity';
import { CalendarEventMapper } from '../mappers/calendar-event.mapper';
import { DomainError } from '@coopenomics/extension-kit';

@Injectable()
export class CalendarEventTypeormRepository implements ChatCoopCalendarEventRepository {
  constructor(
    @InjectRepository(CalendarEventTypeormEntity)
    private readonly repo: Repository<CalendarEventTypeormEntity>
  ) {}

  async create(input: CreateChatCoopCalendarEventDomainInput): Promise<ChatCoopCalendarEventDomainEntity> {
    const row = this.repo.create({
      matrixRoomId: input.matrixRoomId,
      title: input.title,
      description: input.description,
      startsAt: input.startsAt,
      endsAt: input.endsAt,
      createdByUsername: input.createdByUsername,
      icsSequence: 0,
    });
    const saved = await this.repo.save(row);
    return CalendarEventMapper.toDomain(saved);
  }

  async update(input: UpdateChatCoopCalendarEventDomainInput): Promise<ChatCoopCalendarEventDomainEntity> {
    const existing = await this.repo.findOne({ where: { id: input.id } });
    if (!existing) {
      throw DomainError.notFound('CHATCOOP_CALENDAR_EVENT_NOT_FOUND');
    }
    const nextSeq = existing.icsSequence + 1;
    await this.repo.update(
      { id: input.id },
      {
        matrixRoomId: input.matrixRoomId,
        title: input.title,
        description: input.description,
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        icsSequence: nextSeq,
      }
    );
    const updated = await this.repo.findOneOrFail({ where: { id: input.id } });
    return CalendarEventMapper.toDomain(updated);
  }

  async deleteById(id: string): Promise<void> {
    await this.repo.delete({ id });
  }

  async findById(id: string): Promise<ChatCoopCalendarEventDomainEntity | null> {
    const row = await this.repo.findOne({ where: { id } });
    return row ? CalendarEventMapper.toDomain(row) : null;
  }

  async listAll(): Promise<ChatCoopCalendarEventDomainEntity[]> {
    const rows = await this.repo.find({ order: { createdAt: 'DESC' } });
    return rows.map(CalendarEventMapper.toDomain);
  }

  async listByManagedRoomProjectHashes(
    projectHashes: string[],
    window?: { from: Date; to: Date }
  ): Promise<ChatCoopCalendarEventDomainEntity[]> {
    if (projectHashes.length === 0) {
      return [];
    }
    const qb = this.repo
      .createQueryBuilder('e')
      .innerJoin(
        ManagedMatrixRoomTypeormEntity,
        'r',
        'r.matrixRoomId = e.matrixRoomId AND r.encrypted = :enc AND r.projectHash IN (:...hashes)',
        { enc: false, hashes: projectHashes }
      )
      .orderBy('e.startsAt', 'ASC');

    if (window) {
      qb.andWhere('(e.endsAt IS NULL OR e.endsAt > :from)', { from: window.from });
      qb.andWhere('e.startsAt < :to', { to: window.to });
    }

    const rows = await qb.getMany();
    return rows.map(CalendarEventMapper.toDomain);
  }
}
