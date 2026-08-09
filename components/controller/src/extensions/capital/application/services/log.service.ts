import { Injectable, Inject } from '@nestjs/common';
import { MUTATION_LOG_REPOSITORY, MutationLogRepository } from '~/domain/mutation-log/repositories/mutation-log.repository';
import { PROJECT_REPOSITORY, ProjectRepository } from '../../domain/repositories/project.repository';
import { ISSUE_REPOSITORY, IssueRepository } from '../../domain/repositories/issue.repository';
import { ProjectOrigin } from '../../domain/enums/project-origin.enum';
import type { ProjectDomainEntity } from '../../domain/entities/project.entity';
import type { IssueDomainEntity } from '../../domain/entities/issue.entity';
import {
  isFreeIssueParticipant,
  isLocalProjectOwner,
} from '../../domain/utils/private-project-access';
import { LOGGER_PORT, type ILoggerPort } from '@coopenomics/innercoop';
import { MutationLogMapperService, IMappedCapitalLog, LogEntityType } from './mutation-log-mapper.service';
import type { PaginationInputDTO, PaginationResult } from '@coopenomics/extension-kit';

/**
 * Интерфейс фильтрации логов capital
 */
export interface ICapitalLogFilterInput {
  /** Название кооператива */
  coopname?: string;

  /** Хеш проекта или компонента */
  project_hash?: string;

  /** Хеш задачи */
  issue_hash?: string;

  /** Показывать логи по задачам (по умолчанию true) */
  show_issue_logs?: boolean;

  /** Инициатор действия */
  initiator?: string;

  /** Период с */
  date_from?: Date;

  /** Период по */
  date_to?: Date;

  /** Включать логи дочерних компонентов при фильтрации по project_hash */
  show_components_logs?: boolean;

  /** Текущий пользователь — для скрытия чужих персональных данных */
  viewer_username?: string;
}

/**
 * Сервис для работы с логами событий capital
 * Извлекает данные из общего репозитория логов мутаций
 * и преобразует их в читаемые логи событий
 */
@Injectable()
export class LogService {
  constructor(
    @Inject(MUTATION_LOG_REPOSITORY)
    private readonly mutationLogRepository: MutationLogRepository,
    @Inject(PROJECT_REPOSITORY)
    private readonly projectRepository: ProjectRepository,
    @Inject(ISSUE_REPOSITORY)
    private readonly issueRepository: IssueRepository,
    private readonly mutationLogMapper: MutationLogMapperService,
    @Inject(LOGGER_PORT) private readonly logger: ILoggerPort
  ) {
    this.logger.setContext(LogService.name);
  }

  /**
   * Получение логов с фильтрацией и пагинацией
   */
  async getLogs(
    filter?: ICapitalLogFilterInput,
    options?: PaginationInputDTO
  ): Promise<PaginationResult<IMappedCapitalLog>> {
    // Получаем только мутации, относящиеся к capital расширению
    const mutationNames = this.mutationLogMapper.getCapitalMutationNames();

    const mutationFilter = {
      mutation_names: mutationNames,
      coopname: filter?.coopname,
      username: filter?.initiator,
      date_from: filter?.date_from,
      date_to: filter?.date_to,
      status: 'success' as const, // Показываем только успешные мутации
    };

    // Получаем все capital логи без пагинации для правильной фильтрации
    const allResult = await this.mutationLogRepository.findAll(mutationFilter);

    // Преобразуем логи мутаций в логи событий capital
    let mappedLogs = await this.mutationLogMapper.mapMultipleToCapitalLogs(allResult.items);

    // Фильтруем по project_hash или issue_id если указаны
    if (filter?.project_hash) {
      // Определяем, нужно ли включать логи дочерних компонентов
      const showComponentsLogs = filter.show_components_logs !== false; // По умолчанию true

      let projectHashesToFilter: string[] = [filter.project_hash];

      if (showComponentsLogs) {
        // Получаем дочерние компоненты проекта
        try {
          const components = await this.projectRepository.findComponentsByParentHash(filter.project_hash);
          const componentHashes = components.map((component) => component.project_hash);
          projectHashesToFilter = projectHashesToFilter.concat(componentHashes);
        } catch (error) {
          this.logger.warn(`Failed to fetch components for project ${filter.project_hash}`, { error });
          // Продолжаем с только родительским проектом
        }
      }

      // Фильтруем логи по всем выбранным проектам (родительскому + компонентам)
      mappedLogs = mappedLogs.filter((log) => log.project_hash && projectHashesToFilter.includes(log.project_hash));
    } else if (filter?.issue_hash) {
      // Фильтруем логи по issue_hash (теперь приходит напрямую)
      mappedLogs = mappedLogs.filter((log) => log.entity_id === filter.issue_hash || log.reference_id === filter.issue_hash);
    }

    // Фильтруем логи задач, если show_issue_logs = false
    const showIssueLogs = filter?.show_issue_logs !== false; // По умолчанию true
    if (!showIssueLogs) {
      mappedLogs = mappedLogs.filter((log) => log.entity_type !== LogEntityType.ISSUE);
    }

    // Чужие персональные проекты / свободные задачи не показываем (в любой выдаче логов)
    mappedLogs = await this.filterOutForeignPrivateLogs(mappedLogs, filter?.viewer_username);

    // Сортируем по времени создания (новые сверху)
    mappedLogs.sort((a, b) => b.created_at.getTime() - a.created_at.getTime());

    // Применяем пагинацию к отфильтрованным и отсортированным результатам
    const page = options?.page || 1;
    const limit = options?.limit || 10;
    const offset = (page - 1) * limit;
    const paginatedItems = mappedLogs.slice(offset, offset + limit);

    return {
      items: paginatedItems,
      totalCount: mappedLogs.length,
      totalPages: Math.ceil(mappedLogs.length / limit),
      currentPage: page,
    };
  }

  /**
   * Скрывает чужие LOCAL-проекты и чужие свободные задачи.
   * Кооперативные события остаются общими; свои персональные — видны владельцу.
   */
  private async filterOutForeignPrivateLogs(
    logs: IMappedCapitalLog[],
    viewerUsername?: string
  ): Promise<IMappedCapitalLog[]> {
    if (logs.length === 0) {
      return logs;
    }

    const candidateIssueHashes = new Set<string>();
    const projectHashes = new Set<string>();

    for (const log of logs) {
      if (
        (log.entity_type === LogEntityType.ISSUE || log.entity_type === LogEntityType.STORY) &&
        log.entity_id
      ) {
        candidateIssueHashes.add(log.entity_id.toLowerCase());
      }
      if (log.project_hash) {
        projectHashes.add(log.project_hash.toLowerCase());
      }
    }

    const issueMap = new Map<string, IssueDomainEntity>();
    await Promise.all(
      [...candidateIssueHashes].map(async (issueHash) => {
        const issue = await this.issueRepository.findByIssueHash(issueHash);
        if (issue) {
          issueMap.set(issueHash, issue);
          if (issue.project_hash?.trim()) {
            projectHashes.add(issue.project_hash.trim().toLowerCase());
          }
        }
      })
    );

    const projects =
      projectHashes.size > 0 ? await this.projectRepository.findByHashes([...projectHashes]) : [];
    const projectMap = new Map<string, ProjectDomainEntity>(
      projects.map((project) => [project.project_hash.toLowerCase(), project])
    );

    return logs.filter((log) => {
      let issue: IssueDomainEntity | undefined;
      if (
        (log.entity_type === LogEntityType.ISSUE || log.entity_type === LogEntityType.STORY) &&
        log.entity_id
      ) {
        issue = issueMap.get(log.entity_id.toLowerCase());
      }

      const projectHash =
        issue?.project_hash?.trim()?.toLowerCase() || log.project_hash?.toLowerCase() || null;
      const project = projectHash ? projectMap.get(projectHash) : undefined;

      // Свободная задача (нет проекта) — только участникам
      if (issue && !issue.project_hash?.trim()) {
        return isFreeIssueParticipant(issue, viewerUsername);
      }

      // LOCAL-проект — только владельцу
      if (project?.origin === ProjectOrigin.LOCAL) {
        return isLocalProjectOwner(project, viewerUsername);
      }

      // Лог с project_hash LOCAL, даже без issue
      if (log.project_hash) {
        const logProject = projectMap.get(log.project_hash.toLowerCase());
        if (logProject?.origin === ProjectOrigin.LOCAL) {
          return isLocalProjectOwner(logProject, viewerUsername);
        }
      }

      // Кооперативные и прочие события — в общей ленте
      return true;
    });
  }

  /**
   * Получение логов по хешу проекта
   */
  async getLogsByProjectHash(
    projectHash: string,
    options?: PaginationInputDTO,
    viewerUsername?: string
  ): Promise<PaginationResult<IMappedCapitalLog>> {
    return this.getLogs({ project_hash: projectHash, viewer_username: viewerUsername }, options);
  }

  /**
   * Получение логов по хешу задачи
   */
  async getLogsByIssueHash(
    issueHash: string,
    options?: PaginationInputDTO,
    viewerUsername?: string
  ): Promise<PaginationResult<IMappedCapitalLog>> {
    return this.getLogs({ issue_hash: issueHash, viewer_username: viewerUsername }, options);
  }

  /**
   * Получение логов по инициатору
   */
  async getLogsByInitiator(
    initiator: string,
    options?: PaginationInputDTO,
    viewerUsername?: string
  ): Promise<PaginationResult<IMappedCapitalLog>> {
    return this.getLogs({ initiator, viewer_username: viewerUsername }, options);
  }

  /**
   * Получение лога по ID
   */
  async getLogById(id: string): Promise<IMappedCapitalLog | null> {
    const mutationLog = await this.mutationLogRepository.findById(id);

    if (!mutationLog) {
      return null;
    }

    // Проверяем, что это мутация capital расширения
    if (!this.mutationLogMapper.isCapitalMutation(mutationLog.mutation_name)) {
      return null;
    }

    return this.mutationLogMapper.mapToCapitalLog(mutationLog);
  }
}
