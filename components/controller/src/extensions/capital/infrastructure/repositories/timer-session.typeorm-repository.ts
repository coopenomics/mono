import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { TimerSessionEntity } from '../entities/timer-session.entity';
import type { TimerSessionRepository } from '../../domain/repositories/timer-session.repository';
import { TimerSessionDomainEntity } from '../../domain/entities/timer-session.entity';

@Injectable()
export class TimerSessionTypeormRepository implements TimerSessionRepository {
  constructor(
    @InjectRepository(TimerSessionEntity)
    private readonly repository: Repository<TimerSessionEntity>
  ) {}

  async create(session: TimerSessionDomainEntity): Promise<TimerSessionDomainEntity> {
    const saved = await this.repository.save(this.toEntity(session));
    return this.toDomain(saved);
  }

  async update(session: TimerSessionDomainEntity): Promise<TimerSessionDomainEntity> {
    await this.repository.update(session._id, {
      stopped_at: session.stopped_at ?? null,
      paused_at: session.paused_at ?? null,
      total_paused_ms: Number(session.total_paused_ms || 0),
      _updated_at: new Date(),
    });
    const updated = await this.repository.findOne({ where: { _id: session._id } });
    if (!updated) throw new Error('Timer session not found after update');
    return this.toDomain(updated);
  }

  async findOpenByContributor(contributorHash: string): Promise<TimerSessionDomainEntity | null> {
    const entity = await this.repository.findOne({
      where: { contributor_hash: contributorHash, stopped_at: IsNull() },
      order: { started_at: 'DESC' },
    });
    return entity ? this.toDomain(entity) : null;
  }

  async findById(id: string): Promise<TimerSessionDomainEntity | null> {
    const entity = await this.repository.findOne({ where: { _id: id } });
    return entity ? this.toDomain(entity) : null;
  }

  async findAllOpen(): Promise<TimerSessionDomainEntity[]> {
    const entities = await this.repository.find({
      where: { stopped_at: IsNull() },
      order: { started_at: 'ASC' },
    });
    return entities.map((e) => this.toDomain(e));
  }

  private toEntity(domain: TimerSessionDomainEntity): TimerSessionEntity {
    const entity = new TimerSessionEntity();
    if (domain._id) entity._id = domain._id;
    entity.contributor_hash = domain.contributor_hash;
    entity.issue_hash = domain.issue_hash;
    entity.project_hash = domain.project_hash;
    entity.coopname = domain.coopname;
    entity.started_at = domain.started_at;
    entity.stopped_at = domain.stopped_at ?? null;
    entity.paused_at = domain.paused_at ?? null;
    entity.total_paused_ms = Number(domain.total_paused_ms || 0);
    entity.block_num = 0;
    entity.present = false;
    entity.status = 'active';
    return entity;
  }

  private toDomain(entity: TimerSessionEntity): TimerSessionDomainEntity {
    return new TimerSessionDomainEntity({
      _id: entity._id,
      contributor_hash: entity.contributor_hash,
      issue_hash: entity.issue_hash,
      project_hash: entity.project_hash,
      coopname: entity.coopname,
      started_at: entity.started_at,
      stopped_at: entity.stopped_at,
      paused_at: entity.paused_at,
      total_paused_ms: Number(entity.total_paused_ms || 0),
    });
  }
}
