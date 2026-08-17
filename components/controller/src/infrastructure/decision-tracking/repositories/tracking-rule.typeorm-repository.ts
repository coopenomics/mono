import { Injectable } from '@nestjs/common';
import { Repository } from 'typeorm';
import { InjectRepository } from '@nestjs/typeorm';
import { TrackingRuleEntity } from '../entities/tracking-rule.entity';
import { TrackingRule, DecisionEventType } from '@coopenomics/innercoop';

/**
 * TypeORM репозиторий для правил отслеживания решений
 */
@Injectable()
export class TrackingRuleTypeormRepository {
  constructor(
    @InjectRepository(TrackingRuleEntity)
    private readonly repository: Repository<TrackingRuleEntity>
  ) {}

  async save(rule: TrackingRule): Promise<TrackingRule> {
    const entity = this.toEntity(rule);
    const savedEntity = await this.repository.save(entity);
    return this.toDomain(savedEntity);
  }

  async findById(id: string): Promise<TrackingRule | null> {
    const entity = await this.repository.findOne({ where: { id } });
    return entity ? this.toDomain(entity) : null;
  }

  async findByHash(hash: string): Promise<TrackingRule | null> {
    const entity = await this.repository.findOne({
      where: { hash, active: true },
    });
    return entity ? this.toDomain(entity) : null;
  }

  async findAllActive(): Promise<TrackingRule[]> {
    const entities = await this.repository.find({
      where: { active: true },
      order: { created_at: 'ASC' },
    });

    return entities.map((entity) => this.toDomain(entity));
  }

  async update(rule: TrackingRule): Promise<TrackingRule> {
    const entity = this.toEntity(rule);
    await this.repository.update(rule.id, entity);
    const updatedEntity = await this.repository.findOne({ where: { id: rule.id } });
    if (!updatedEntity) {
      throw new Error(`Tracking rule with id ${rule.id} not found after update`);
    }
    return this.toDomain(updatedEntity);
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }

  private toEntity(domain: TrackingRule): TrackingRuleEntity {
    const entity = new TrackingRuleEntity();
    entity.id = domain.id;
    entity.hash = domain.hash;
    entity.event_type = domain.event_type;
    entity.vars_field = domain.vars_field;
    entity.metadata = domain.metadata;
    entity.active = domain.active;
    entity.created_at = domain.created_at;
    return entity;
  }

  private toDomain(entity: TrackingRuleEntity): TrackingRule {
    return {
      id: entity.id,
      hash: entity.hash,
      event_type: entity.event_type as DecisionEventType,
      vars_field: entity.vars_field,
      metadata: entity.metadata ?? {},
      active: entity.active,
      created_at: entity.created_at,
    };
  }
}
