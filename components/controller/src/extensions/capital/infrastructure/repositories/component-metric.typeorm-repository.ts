import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ComponentMetricRepository } from '../../domain/repositories/component-metric.repository';
import { ComponentMetricDomainEntity } from '../../domain/entities/component-metric.entity';
import { MetricStatus } from '../../domain/enums/metric-status.enum';
import { ComponentMetricTypeormEntity } from '../entities/component-metric.typeorm-entity';
import { ComponentMetricMapper } from '../mappers/component-metric.mapper';

@Injectable()
export class ComponentMetricTypeormRepository implements ComponentMetricRepository {
  constructor(
    @InjectRepository(ComponentMetricTypeormEntity)
    private readonly repo: Repository<ComponentMetricTypeormEntity>
  ) {}

  async create(metric: ComponentMetricDomainEntity): Promise<ComponentMetricDomainEntity> {
    const entity = this.repo.create(ComponentMetricMapper.toEntity(metric));
    const saved = await this.repo.save(entity);
    return ComponentMetricMapper.toDomain(saved);
  }

  async findByMetricHash(metricHash: string): Promise<ComponentMetricDomainEntity | null> {
    const entity = await this.repo.findOne({ where: { metric_hash: metricHash.toLowerCase() } });
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
    const entities = await this.repo.find({
      where,
      order: { _created_at: 'ASC' },
    });
    return entities.map(ComponentMetricMapper.toDomain);
  }

  async update(metric: ComponentMetricDomainEntity): Promise<ComponentMetricDomainEntity> {
    await this.repo.save(ComponentMetricMapper.toEntity(metric));
    const updated = await this.repo.findOne({ where: { _id: metric._id } });
    if (!updated) {
      throw new Error(`Метрика ${metric.metric_hash} не найдена после обновления`);
    }
    return ComponentMetricMapper.toDomain(updated);
  }
}
