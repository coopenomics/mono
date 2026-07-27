import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { IssueMetricBindingRepository } from '../../domain/repositories/issue-metric-binding.repository';
import { IssueMetricBindingDomainEntity } from '../../domain/entities/issue-metric-binding.entity';
import { IssueMetricBindingTypeormEntity } from '../entities/issue-metric-binding.typeorm-entity';
import { IssueMetricBindingMapper } from '../mappers/issue-metric-binding.mapper';

@Injectable()
export class IssueMetricBindingTypeormRepository implements IssueMetricBindingRepository {
  constructor(
    @InjectRepository(IssueMetricBindingTypeormEntity)
    private readonly repo: Repository<IssueMetricBindingTypeormEntity>
  ) {}

  async findByIssueHash(issueHash: string): Promise<IssueMetricBindingDomainEntity[]> {
    const entities = await this.repo.find({
      where: { issue_hash: issueHash.toLowerCase() },
    });
    return entities.map(IssueMetricBindingMapper.toDomain);
  }

  async findByMetricHash(metricHash: string): Promise<IssueMetricBindingDomainEntity[]> {
    const entities = await this.repo.find({
      where: { metric_hash: metricHash.toLowerCase() },
    });
    return entities.map(IssueMetricBindingMapper.toDomain);
  }

  async replaceForIssue(
    issueHash: string,
    bindings: IssueMetricBindingDomainEntity[]
  ): Promise<IssueMetricBindingDomainEntity[]> {
    const normalizedIssue = issueHash.toLowerCase();
    await this.repo.delete({ issue_hash: normalizedIssue });
    if (bindings.length === 0) {
      return [];
    }
    const entities = bindings.map((b) => this.repo.create(IssueMetricBindingMapper.toEntity(b)));
    const saved = await this.repo.save(entities);
    return saved.map(IssueMetricBindingMapper.toDomain);
  }

  async deleteByIssueHash(issueHash: string): Promise<void> {
    await this.repo.delete({ issue_hash: issueHash.toLowerCase() });
  }
}
