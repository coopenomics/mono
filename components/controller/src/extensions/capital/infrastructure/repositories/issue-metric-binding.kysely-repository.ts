import { CAPITAL_ISSUE_METRIC_BINDING_STORE } from '../database/capital-stores';
import { type TableStore } from '@coopenomics/extension-kit';
import { Inject, Injectable } from '@nestjs/common';
import { IssueMetricBindingRepository } from '../../domain/repositories/issue-metric-binding.repository';
import { IssueMetricBindingDomainEntity } from '../../domain/entities/issue-metric-binding.entity';
import { IssueMetricBindingRecord } from '../entities/issue-metric-binding.record';
import { IssueMetricBindingMapper } from '../mappers/issue-metric-binding.mapper';

@Injectable()
export class IssueMetricBindingKyselyRepository implements IssueMetricBindingRepository {
  constructor(
    @Inject(CAPITAL_ISSUE_METRIC_BINDING_STORE)
    private readonly repo: TableStore<IssueMetricBindingRecord>
  ) {}

  async findByIssueHash(issueHash: string): Promise<IssueMetricBindingDomainEntity[]> {
    const entities = await this.repo.find({ issue_hash: issueHash.toLowerCase() });
    return entities.map(IssueMetricBindingMapper.toDomain);
  }

  async findByMetricHash(metricHash: string): Promise<IssueMetricBindingDomainEntity[]> {
    const entities = await this.repo.find({ metric_hash: metricHash.toLowerCase() });
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
