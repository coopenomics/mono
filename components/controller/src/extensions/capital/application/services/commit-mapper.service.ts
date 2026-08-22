import { Injectable, Inject } from '@nestjs/common';
import { CommitDomainEntity, type CommitData } from '../../domain/entities/commit.entity';
import { CommitOutputDTO, CommitAmountsOutputDTO } from '../dto/generation/commit.dto';
import { BaseProjectOutputDTO } from '../dto/project_management/project.dto';
import { ProjectRepository, PROJECT_REPOSITORY } from '../../domain/repositories/project.repository';
import { ProjectMapperService } from './project-mapper.service';
import { TimeTrackingService } from './time-tracking.service';
import type { IMonoAccount } from '@coopenomics/innercoop';

/**
 * Сервис для маппинга доменных сущностей коммитов в DTO
 * Централизует логику преобразования и обогащения коммитов данными о проекте и amounts
 */
@Injectable()
export class CommitMapperService {
  constructor(
    @Inject(PROJECT_REPOSITORY)
    private readonly projectRepository: ProjectRepository,
    private readonly projectMapperService: ProjectMapperService,
    private readonly timeTrackingService: TimeTrackingService
  ) {}

  /**
   * Преобразование доменной сущности коммита в CommitOutputDTO
   * Обогащает коммит данными о проекте и amounts
   */
  async toDTO(commitEntity: CommitDomainEntity, currentUser?: IMonoAccount): Promise<CommitOutputDTO> {
    let project: BaseProjectOutputDTO | undefined;
    if (commitEntity.project_hash) {
      const projectEntity = await this.projectRepository.findByHash(commitEntity.project_hash);
      if (projectEntity) {
        const projectsWithPermissions = await this.projectMapperService.mapBatchToBaseDTO([projectEntity], currentUser);
        project = projectsWithPermissions[0];
      }
    }

    const amounts = commitEntity.amounts ? this.mapAmountsToDTO(commitEntity.amounts) : undefined;
    const data = await this.ensureCommittedIssuesInData(commitEntity);

    return {
      ...commitEntity,
      project,
      amounts,
      data,
    } as CommitOutputDTO;
  }

  /**
   * Пакетное преобразование массива доменных сущностей коммитов в массив CommitOutputDTO
   */
  async toDTOBatch(
    commitEntities: CommitDomainEntity[],
    currentUser?: IMonoAccount
  ): Promise<CommitOutputDTO[]> {
    const projectHashes: string[] = commitEntities
      .map((commit) => commit.project_hash)
      .filter((hash): hash is string => hash !== null && hash !== undefined);

    const projects = projectHashes.length > 0 ? await this.projectRepository.findByHashes(projectHashes) : [];
    const projectsWithPermissions = await this.projectMapperService.mapBatchToBaseDTO(projects, currentUser);
    const projectsMap = new Map(projectsWithPermissions.map((project) => [project.project_hash, project]));

    const enriched: CommitOutputDTO[] = [];
    for (const commit of commitEntities) {
      const project = commit.project_hash ? projectsMap.get(commit.project_hash) : undefined;
      const amounts = commit.amounts ? this.mapAmountsToDTO(commit.amounts) : undefined;
      const data = await this.ensureCommittedIssuesInData(commit);
      enriched.push({
        ...commit,
        project,
        amounts,
        data,
      } as CommitOutputDTO);
    }
    return enriched;
  }

  /**
   * Для старых коммитов без снимка задач — подтянуть из time_entries (только в DTO, без записи в БД).
   */
  private async ensureCommittedIssuesInData(commit: CommitDomainEntity): Promise<CommitData | null | undefined> {
    const base = Array.isArray(commit.data) ? [...commit.data] : [];
    const hasSnapshot = base.some((item) => item?.type === 'committed_issues');
    if (hasSnapshot) return commit.data;

    const issues = await this.timeTrackingService.getCommittedIssueSummaries(commit.commit_hash);
    if (!issues.length) return commit.data;

    base.push({ type: 'committed_issues', data: { issues } });
    return base;
  }

  private mapAmountsToDTO(amounts: any): CommitAmountsOutputDTO {
    return {
      hour_cost: amounts.hour_cost?.toString(),
      creators_hours: amounts.creators_hours?.toString(),
      creators_base_pool: amounts.creators_base_pool?.toString(),
      authors_base_pool: amounts.authors_base_pool?.toString(),
      creators_bonus_pool: amounts.creators_bonus_pool?.toString(),
      authors_bonus_pool: amounts.authors_bonus_pool?.toString(),
      total_generation_pool: amounts.total_generation_pool?.toString(),
      contributors_bonus_pool: amounts.contributors_bonus_pool?.toString(),
      total_contribution: amounts.total_contribution?.toString(),
    };
  }
}
