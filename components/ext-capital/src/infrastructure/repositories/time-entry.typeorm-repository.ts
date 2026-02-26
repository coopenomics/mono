import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { TimeEntryEntity } from '../entities/time-entry.entity';
import { TimeEntryRepository } from '../../domain/repositories/time-entry.repository';
import { TimeEntryDomainEntity } from '../../domain/entities/time-entry.entity';
import type { ITimeEntryDatabaseData } from '../../domain/interfaces/time-entry-database.interface';
import type { TimeEntriesFilterDomainInterface } from '../../domain/interfaces/time-entries-filter-domain.interface';
import type {
  PaginationInputDomainInterface,
  PaginationResultDomainInterface,
} from '~/domain/common/interfaces/pagination.interface';
import type { ContributorProjectBasicTimeStatsDomainInterface } from '../../domain/interfaces/time-stats-domain.interface';
import type { TimeEntriesByIssuesDomainInterface } from '../../domain/interfaces/time-entries-by-issues-domain.interface';
import { CAPITAL_DATABASE_CONNECTION } from '../database/capital-database.module';

/**
 * TypeORM реализация репозитория записей времени
 */
@Injectable()
export class TimeEntryTypeormRepository implements TimeEntryRepository {
  constructor(
    @InjectRepository(TimeEntryEntity, CAPITAL_DATABASE_CONNECTION)
    private readonly repository: Repository<TimeEntryEntity>
  ) {}

  async create(timeEntry: TimeEntryDomainEntity): Promise<TimeEntryDomainEntity> {
    const entity = this.toEntity(timeEntry);
    const savedEntity = await this.repository.save(entity);
    return this.toDomain(savedEntity);
  }

  async findByContributorAndDate(contributorHash: string, date: string): Promise<TimeEntryDomainEntity[]> {
    const entities = await this.repository.find({
      where: { contributor_hash: contributorHash, date },
    });
    return entities.map((entity) => this.toDomain(entity));
  }

  async findUncommittedByContributor(contributorHash: string): Promise<TimeEntryDomainEntity[]> {
    const entities = await this.repository.find({
      where: { contributor_hash: contributorHash, is_committed: false },
      order: { date: 'ASC' },
    });
    return entities.map((entity) => this.toDomain(entity));
  }

  async findUncommittedByProjectAndContributor(
    projectHash: string,
    contributorHash: string
  ): Promise<TimeEntryDomainEntity[]> {
    const entities = await this.repository.find({
      where: {
        project_hash: projectHash,
        contributor_hash: contributorHash,
        is_committed: false,
      },
      order: { date: 'ASC' },
    });
    return entities.map((entity) => this.toDomain(entity));
  }

  async update(timeEntry: TimeEntryDomainEntity): Promise<TimeEntryDomainEntity> {
    const entity = this.toEntity(timeEntry);
    await this.repository.update(entity._id, entity);
    const updatedEntity = await this.repository.findOne({ where: { _id: entity._id } });
    if (!updatedEntity) throw new Error('Time entry not found after update');
    return this.toDomain(updatedEntity);
  }

  async updateMany(timeEntries: TimeEntryDomainEntity[]): Promise<void> {
    const entities = timeEntries.map((entry) => this.toEntity(entry));
    await this.repository.save(entities);
  }

  async getTotalUncommittedHours(contributorHash: string, projectHash: string): Promise<number> {
    const result = await this.repository
      .createQueryBuilder('te')
      .select('SUM(te.hours)', 'total')
      .where('te.contributor_hash = :contributorHash', { contributorHash })
      .andWhere('te.project_hash = :projectHash', { projectHash })
      .andWhere('te.is_committed = false')
      .getRawOne();

    return parseFloat(result?.total || '0');
  }

  async getContributorProjectStats(
    contributorHash: string,
    projectHash: string
  ): Promise<ContributorProjectBasicTimeStatsDomainInterface> {
    // Получаем суммарное закоммиченное время
    const committedResult = await this.repository
      .createQueryBuilder('te')
      .select('SUM(te.hours)', 'total')
      .where('te.contributor_hash = :contributorHash', { contributorHash })
      .andWhere('te.project_hash = :projectHash', { projectHash })
      .andWhere('te.is_committed = true')
      .getRawOne();

    // Получаем суммарное незакоммиченное время
    const uncommittedResult = await this.repository
      .createQueryBuilder('te')
      .select('SUM(te.hours)', 'total')
      .where('te.contributor_hash = :contributorHash', { contributorHash })
      .andWhere('te.project_hash = :projectHash', { projectHash })
      .andWhere('te.is_committed = false')
      .getRawOne();

    const total_committed_hours = parseFloat(committedResult?.total || '0');
    const total_uncommitted_hours = parseFloat(uncommittedResult?.total || '0');

    // Репозиторий возвращает только базовую статистику (committed/uncommitted)
    return {
      total_committed_hours,
      total_uncommitted_hours,
    };
  }

  async commitTimeEntries(entries: TimeEntryDomainEntity[], commitHash: string): Promise<void> {
    const ids = entries.map((entry) => entry._id);
    await this.repository.update({ _id: In(ids) }, { commit_hash: commitHash, is_committed: true, _updated_at: new Date() });
  }

  async delete(id: string): Promise<void> {
    await this.repository.delete(id);
  }

  async findProjectsByContributor(contributorHash: string): Promise<{ project_hash: string; project_name?: string }[]> {
    // Получаем уникальные project_hash из записей времени участника
    const result = await this.repository
      .createQueryBuilder('te')
      .select('DISTINCT te.project_hash', 'project_hash')
      .where('te.contributor_hash = :contributorHash', { contributorHash })
      .getRawMany();

    const projectHashes = result.map((row) => row.project_hash);

    // Если нет проектов, возвращаем пустой массив
    if (projectHashes.length === 0) {
      return [];
    }

    // Получаем данные о проектах из блокчейна через deltas
    // Пока что вернём просто project_hash без имени, так как это требует сложного запроса к deltas
    // В будущем можно будет добавить join с таблицей deltas для получения названия проекта
    return projectHashes.map((project_hash) => ({
      project_hash,
      project_name: undefined, // Временно undefined, можно получить из deltas по необходимости
    }));
  }

  async findContributorsByProject(projectHash: string): Promise<{ contributor_hash: string }[]> {
    // Получаем уникальные contributor_hash из записей времени по проекту
    const result = await this.repository
      .createQueryBuilder('te')
      .select('DISTINCT te.contributor_hash', 'contributor_hash')
      .where('te.project_hash = :projectHash', { projectHash })
      .getRawMany();

    return result.map((row) => ({ contributor_hash: row.contributor_hash }));
  }

  async findByProjectWithPagination(
    filter: TimeEntriesFilterDomainInterface,
    options?: PaginationInputDomainInterface
  ): Promise<PaginationResultDomainInterface<TimeEntryDomainEntity>> {
    const query = this.repository.createQueryBuilder('te');

    // Добавляем условие по project_hash только если он указан
    if (filter.projectHash) {
      query.where('te.project_hash = :projectHash', { projectHash: filter.projectHash });
    }

    if (filter.contributorHash) {
      query.andWhere('te.contributor_hash = :contributorHash', { contributorHash: filter.contributorHash });
    }

    if (filter.isCommitted !== undefined) {
      query.andWhere('te.is_committed = :isCommitted', { isCommitted: filter.isCommitted });
    }

    if (filter.coopname) {
      query.andWhere('te.coopname = :coopname', { coopname: filter.coopname });
    }

    if (filter.issueHash) {
      query.andWhere('te.issue_hash = :issueHash', { issueHash: filter.issueHash });
    }

    // Применяем сортировку
    if (options?.sortBy) {
      const sortOrder = options.sortOrder || 'DESC';
      query.orderBy(`te.${options.sortBy}`, sortOrder);
    } else {
      query.orderBy('te.date', 'DESC').addOrderBy('te._created_at', 'DESC');
    }

    // Получаем общее количество
    const totalCount = await query.getCount();

    // Применяем пагинацию
    const page = options?.page || 1;
    const limit = options?.limit || 10;
    const skip = (page - 1) * limit;

    const entities = await query.skip(skip).take(limit).getMany();

    const totalPages = Math.ceil(totalCount / limit);
    const currentPage = page;

    return {
      items: entities.map((entity) => this.toDomain(entity)),
      totalCount,
      totalPages,
      currentPage,
    };
  }

  private toEntity(domain: TimeEntryDomainEntity): TimeEntryEntity {
    const entity = new TimeEntryEntity();
    Object.assign(entity, domain);
    return entity;
  }

  async getAggregatedTimeEntriesByIssues(
    filter: TimeEntriesFilterDomainInterface,
    limit: number,
    offset: number
  ): Promise<TimeEntriesByIssuesDomainInterface[]> {
    const queryBuilder = this.repository
      .createQueryBuilder('te')
      .select([
        'te.issue_hash',
        'i.title as issue_title',
        'te.project_hash',
        'p.title as project_name',
        'te.contributor_hash',
        'c.display_name as contributor_name',
        'te.coopname',
        'SUM(te.hours) as total_hours',
        'SUM(CASE WHEN te.is_committed = true THEN te.hours ELSE 0 END) as committed_hours',
        'SUM(CASE WHEN te.is_committed = false THEN te.hours ELSE 0 END) as uncommitted_hours',
        // Доступное время: незакоммиченные часы по завершённым задачам (status = 'done')
        "SUM(CASE WHEN te.is_committed = false AND i.status = 'done' THEN te.hours ELSE 0 END) as available_hours",
        // Время в ожидании: незакоммиченные часы по незавершённым задачам (status != 'done')
        "SUM(CASE WHEN te.is_committed = false AND i.status != 'done' THEN te.hours ELSE 0 END) as pending_hours",
      ])
      .innerJoin('capital_issues', 'i', 'te.issue_hash = i.issue_hash')
      .innerJoin('capital_projects', 'p', 'te.project_hash = p.project_hash')
      .innerJoin('capital_contributors', 'c', 'te.contributor_hash = c.contributor_hash')
      .groupBy('te.issue_hash, i.title, te.project_hash, p.title, te.contributor_hash, c.display_name, te.coopname')
      .orderBy('total_hours', 'DESC')
      .limit(limit)
      .offset(offset);

    // Применяем фильтры
    if (filter.projectHash) {
      queryBuilder.andWhere('te.project_hash = :projectHash', { projectHash: filter.projectHash });
    }
    if (filter.contributorHash) {
      queryBuilder.andWhere('te.contributor_hash = :contributorHash', { contributorHash: filter.contributorHash });
    }
    if (filter.issueHash) {
      queryBuilder.andWhere('te.issue_hash = :issueHash', { issueHash: filter.issueHash });
    }
    if (filter.isCommitted !== undefined) {
      queryBuilder.andWhere('te.is_committed = :isCommitted', { isCommitted: filter.isCommitted });
    }
    if (filter.coopname) {
      queryBuilder.andWhere('te.coopname = :coopname', { coopname: filter.coopname });
    }

    const results = await queryBuilder.getRawMany();

    return results.map((row) => ({
      issue_hash: row.te_issue_hash,
      issue_title: row.issue_title,
      project_hash: row.te_project_hash,
      project_name: row.project_name,
      contributor_hash: row.te_contributor_hash,
      contributor_name: row.contributor_name,
      coopname: row.te_coopname,
      total_hours: Number(row.total_hours),
      committed_hours: Number(row.committed_hours),
      uncommitted_hours: Number(row.uncommitted_hours),
      available_hours: Number(row.available_hours),
      pending_hours: Number(row.pending_hours),
    }));
  }

  async getAggregatedTimeEntriesCount(filter: TimeEntriesFilterDomainInterface): Promise<number> {
    const queryBuilder = this.repository
      .createQueryBuilder('te')
      .select("COUNT(DISTINCT (te.issue_hash || '-' || te.project_hash || '-' || te.contributor_hash))", 'count');

    // Применяем фильтры
    if (filter.projectHash) {
      queryBuilder.andWhere('te.project_hash = :projectHash', { projectHash: filter.projectHash });
    }
    if (filter.contributorHash) {
      queryBuilder.andWhere('te.contributor_hash = :contributorHash', { contributorHash: filter.contributorHash });
    }
    if (filter.issueHash) {
      queryBuilder.andWhere('te.issue_hash = :issueHash', { issueHash: filter.issueHash });
    }
    if (filter.isCommitted !== undefined) {
      queryBuilder.andWhere('te.is_committed = :isCommitted', { isCommitted: filter.isCommitted });
    }
    if (filter.coopname) {
      queryBuilder.andWhere('te.coopname = :coopname', { coopname: filter.coopname });
    }

    const result = await queryBuilder.getRawOne();

    return Number(result.count);
  }

  async findByIssueAndType(issueHash: string, entryType: 'hourly' | 'estimate'): Promise<TimeEntryDomainEntity[]> {
    const entities = await this.repository.find({
      where: { issue_hash: issueHash, entry_type: entryType },
    });
    return entities.map((entity) => this.toDomain(entity));
  }

  async getTotalEstimateHoursByIssue(issueHash: string): Promise<{ total: number; estimate_snapshot: number }> {
    const result = await this.repository
      .createQueryBuilder('te')
      .select('SUM(te.hours)', 'total')
      .addSelect('MAX(te.estimate_snapshot)', 'estimate_snapshot')
      .where('te.issue_hash = :issueHash', { issueHash })
      .andWhere("te.entry_type = 'estimate'")
      .getRawOne();

    return {
      total: parseFloat(result?.total || '0'),
      estimate_snapshot: parseFloat(result?.estimate_snapshot || '0'),
    };
  }

  private toDomain(entity: TimeEntryEntity): TimeEntryDomainEntity {
    const databaseData: ITimeEntryDatabaseData = {
      _id: entity._id,
      block_num: entity.block_num,
      present: entity.present,
      status: entity.status,
      _created_at: entity._created_at,
      _updated_at: entity._updated_at,
      contributor_hash: entity.contributor_hash,
      issue_hash: entity.issue_hash,
      project_hash: entity.project_hash,
      coopname: entity.coopname,
      date: entity.date,
      hours: Number(entity.hours),
      commit_hash: entity.commit_hash,
      is_committed: entity.is_committed,
      entry_type: entity.entry_type as 'hourly' | 'estimate' | undefined,
      estimate_snapshot: entity.estimate_snapshot,
    };
    return new TimeEntryDomainEntity(databaseData);
  }
}
