import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MetricContributionRepository } from '../../domain/repositories/metric-contribution.repository';
import { MetricContributionDomainEntity } from '../../domain/entities/metric-contribution.entity';
import { MetricContributionSource } from '../../domain/enums/metric-contribution-source.enum';
import { MetricContributionTypeormEntity } from '../entities/metric-contribution.typeorm-entity';
import { MetricContributionMapper } from '../mappers/metric-contribution.mapper';
import type {
  PaginationInputDomainInterface,
  PaginationResultDomainInterface,
} from '~/domain/common/interfaces/pagination.interface';
import { PaginationUtils } from '~/shared/utils/pagination.utils';

@Injectable()
export class MetricContributionTypeormRepository implements MetricContributionRepository {
  constructor(
    @InjectRepository(MetricContributionTypeormEntity)
    private readonly repo: Repository<MetricContributionTypeormEntity>
  ) {}

  async create(contribution: MetricContributionDomainEntity): Promise<MetricContributionDomainEntity> {
    const entity = this.repo.create(MetricContributionMapper.toEntity(contribution));
    const saved = await this.repo.save(entity);
    return MetricContributionMapper.toDomain(saved);
  }

  async createMany(
    contributions: MetricContributionDomainEntity[]
  ): Promise<MetricContributionDomainEntity[]> {
    if (contributions.length === 0) {
      return [];
    }
    const entities = contributions.map((c) => this.repo.create(MetricContributionMapper.toEntity(c)));
    const saved = await this.repo.save(entities);
    return saved.map(MetricContributionMapper.toDomain);
  }

  async sumDeltaByMetricHash(metricHash: string): Promise<number> {
    const result = await this.repo
      .createQueryBuilder('c')
      .select('COALESCE(SUM(c.delta), 0)', 'total')
      .where('c.metric_hash = :metricHash', { metricHash: metricHash.toLowerCase() })
      .getRawOne<{ total: string }>();
    return Number(result?.total ?? 0);
  }

  async sumDeltaByMetricHashes(metricHashes: string[]): Promise<Map<string, number>> {
    const map = new Map<string, number>();
    if (metricHashes.length === 0) {
      return map;
    }
    const normalized = metricHashes.map((h) => h.toLowerCase());
    const rows = await this.repo
      .createQueryBuilder('c')
      .select('c.metric_hash', 'metric_hash')
      .addSelect('COALESCE(SUM(c.delta), 0)', 'total')
      .where('c.metric_hash IN (:...hashes)', { hashes: normalized })
      .groupBy('c.metric_hash')
      .getRawMany<{ metric_hash: string; total: string }>();

    for (const hash of normalized) {
      map.set(hash, 0);
    }
    for (const row of rows) {
      map.set(row.metric_hash.toLowerCase(), Number(row.total ?? 0));
    }
    return map;
  }

  async findByMetricHashPaginated(
    metricHash: string,
    options?: PaginationInputDomainInterface
  ): Promise<PaginationResultDomainInterface<MetricContributionDomainEntity>> {
    const validated = options
      ? PaginationUtils.validatePaginationOptions(options)
      : { page: 1, limit: 20, sortOrder: 'DESC' as const };
    const { limit, offset } = PaginationUtils.getSqlPaginationParams(validated);

    const where = { metric_hash: metricHash.toLowerCase() };
    const totalCount = await this.repo.count({ where });
    const entities = await this.repo.find({
      where,
      skip: offset,
      take: limit,
      order: { occurred_at: 'DESC' },
    });
    return PaginationUtils.createPaginationResult(
      entities.map(MetricContributionMapper.toDomain),
      totalCount,
      validated
    );
  }

  async sumIssueDoneDeltaByIssueAndMetric(issueHash: string, metricHash: string): Promise<number> {
    const result = await this.repo
      .createQueryBuilder('c')
      .select('COALESCE(SUM(c.delta), 0)', 'total')
      .where('c.issue_hash = :issueHash', { issueHash: issueHash.toLowerCase() })
      .andWhere('c.metric_hash = :metricHash', { metricHash: metricHash.toLowerCase() })
      .andWhere('c.source IN (:...sources)', {
        sources: [MetricContributionSource.ISSUE_DONE, MetricContributionSource.ISSUE_REOPEN],
      })
      .getRawOne<{ total: string }>();
    return Number(result?.total ?? 0);
  }
}
