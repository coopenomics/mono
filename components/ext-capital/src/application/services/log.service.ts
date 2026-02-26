import { Injectable, Inject } from '@nestjs/common';
import { MUTATION_LOG_REPOSITORY, MutationLogRepository } from '~/domain/mutation-log/repositories/mutation-log.repository';
import { PROJECT_REPOSITORY, ProjectRepository } from '../../domain/repositories/project.repository';
import { ISSUE_REPOSITORY, IssueRepository } from '../../domain/repositories/issue.repository';
import type {
  PaginationInputDomainInterface,
  PaginationResultDomainInterface,
} from '~/domain/common/interfaces/pagination.interface';
import { WinstonLoggerService } from '~/application/logger/logger-app.service';
import { MutationLogMapperService, IMappedCapitalLog, LogEntityType } from './mutation-log-mapper.service';

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
    private readonly logger: WinstonLoggerService
  ) {
    this.logger.setContext(LogService.name);
  }

  /**
   * Получение логов с фильтрацией и пагинацией
   */
  async getLogs(
    filter?: ICapitalLogFilterInput,
    options?: PaginationInputDomainInterface
  ): Promise<PaginationResultDomainInterface<IMappedCapitalLog>> {
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
   * Получение логов по хешу проекта
   */
  async getLogsByProjectHash(
    projectHash: string,
    options?: PaginationInputDomainInterface
  ): Promise<PaginationResultDomainInterface<IMappedCapitalLog>> {
    return this.getLogs({ project_hash: projectHash }, options);
  }

  /**
   * Получение логов по хешу задачи
   */
  async getLogsByIssueHash(
    issueHash: string,
    options?: PaginationInputDomainInterface
  ): Promise<PaginationResultDomainInterface<IMappedCapitalLog>> {
    return this.getLogs({ issue_hash: issueHash }, options);
  }

  /**
   * Получение логов по инициатору
   */
  async getLogsByInitiator(
    initiator: string,
    options?: PaginationInputDomainInterface
  ): Promise<PaginationResultDomainInterface<IMappedCapitalLog>> {
    return this.getLogs({ initiator }, options);
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
