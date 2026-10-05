import { CAPITAL_COMPONENT_METRIC_STORE } from '../database/capital-stores';
import { DomainError, type TableStore } from '@coopenomics/extension-kit';
import { Inject, Injectable } from '@nestjs/common';
import { ComponentMetricRepository } from '../../domain/repositories/component-metric.repository';
import { ComponentMetricDomainEntity } from '../../domain/entities/component-metric.entity';
import { MetricStatus } from '../../domain/enums/metric-status.enum';
import { ComponentMetricRecord } from '../entities/component-metric.record';
import { ComponentMetricMapper } from '../mappers/component-metric.mapper';

@Injectable()
export class ComponentMetricKyselyRepository implements ComponentMetricRepository {
  constructor(
    @Inject(CAPITAL_COMPONENT_METRIC_STORE)
    private readonly repo: TableStore<ComponentMetricRecord>
  ) {}

  async create(metric: ComponentMetricDomainEntity): Promise<ComponentMetricDomainEntity> {
    const entity = this.repo.create(ComponentMetricMapper.toEntity(metric));
    const saved = await this.repo.save(entity);
    return ComponentMetricMapper.toDomain(saved);
  }

  async findByMetricHash(metricHash: string): Promise<ComponentMetricDomainEntity | null> {
    const entity = await this.repo.findOne({ metric_hash: metricHash.toLowerCase() });
    return entity ? ComponentMetricMapper.toDomain(entity) : null;
  }

  async findByProjectHash(
    projectHash: string,
    status?: MetricStatus
  ): Promise<ComponentMetricDomainEntity[]> {
    const where: { project_hash: string; status?: MetricStatus } = {
      project_hash: projectHash.toLowerCase(),
    };
    if (status) {
      where.status = status;
    }
    const entities = await this.repo.find(where, { order: { _created_at: 'ASC' } });
    return entities.map(ComponentMetricMapper.toDomain);
  }

  async findByProjectHashes(
    projectHashes: string[],
    status?: MetricStatus
  ): Promise<ComponentMetricDomainEntity[]> {
    if (projectHashes.length === 0) return [];
    const normalized = projectHashes.map((h) => h.toLowerCase());
    const qb = this.repo
      .sqlBuilder('m')
      .where('m.project_hash IN (:...hashes)', { hashes: normalized })
      .orderBy('m._created_at', 'ASC');
    if (status) {
      qb.andWhere('m.status = :status', { status });
    }
    const entities = await qb.getMany();
    return entities.map(ComponentMetricMapper.toDomain);
  }

  async update(metric: ComponentMetricDomainEntity): Promise<ComponentMetricDomainEntity> {
    await this.repo.save(ComponentMetricMapper.toEntity(metric));
    const updated = await this.repo.findOne({ _id: metric._id });
    if (!updated) {
      throw DomainError.internal('CAPITAL_METRIC_NOT_FOUND_AFTER_UPDATE', { hash: metric.metric_hash });
    }
    return ComponentMetricMapper.toDomain(updated);
  }
}
