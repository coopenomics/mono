import { Injectable, Inject, Optional, Logger } from '@nestjs/common';
import { generateUniqueHash } from '~/utils/generate-hash.util';
import { GenerationInteractor } from '../use-cases/generation.interactor';
import type { CreateCommitInputDTO } from '../dto/generation/create-commit-input.dto';
import { hoursAlmostEqual } from '../../domain/utils/hours-float';
import type { CommitApproveInputDTO } from '../dto/generation/commit-approve-input.dto';
import type { CommitDeclineInputDTO } from '../dto/generation/commit-decline-input.dto';
import type { CommitApproveDomainInput } from '../../domain/actions/commit-approve-domain-input.interface';
import type { CommitDeclineDomainInput } from '../../domain/actions/commit-decline-domain-input.interface';
import type { CreateStoryInputDTO } from '../dto/generation/create-story-input.dto';
import type { CreateIssueInputDTO } from '../dto/generation/create-issue-input.dto';
import type { CreateCycleInputDTO } from '../dto/generation/create-cycle-input.dto';
import type { UpdateStoryInputDTO } from '../dto/generation/update-story-input.dto';
import type { UpdateIssueInputDTO } from '../dto/generation/update-issue-input.dto';
import type { MoveCapitalIssueToComponentInputDTO } from '../dto/generation/move-capital-issue-to-component.input';
import type { StoryFilterInputDTO } from '../dto/generation/story-filter.input';
import type { IssueFilterInputDTO } from '../dto/generation/issue-filter.input';
import type { CommitFilterInputDTO } from '../dto/generation/commit-filter.input';
import type { CycleFilterInputDTO } from '../dto/generation/cycle-filter.input';
import type { GetIssueByIdInputDTO } from '../dto/generation/get-issue-by-id.input';
import type { GetCommitByIdInputDTO } from '../dto/generation/get-commit-by-id.input';
import { STORY_REPOSITORY, StoryRepository } from '../../domain/repositories/story.repository';
import { ISSUE_REPOSITORY, IssueRepository } from '../../domain/repositories/issue.repository';
import { PROJECT_REPOSITORY, ProjectRepository } from '../../domain/repositories/project.repository';
import { COMMIT_REPOSITORY, CommitRepository } from '../../domain/repositories/commit.repository';
import { CYCLE_REPOSITORY, CycleRepository } from '../../domain/repositories/cycle.repository';
import { IssueIdGenerationService } from '../../domain/services/issue-id-generation.service';
import { StoryOutputDTO } from '../dto/generation/story.dto';
import { IssueLinkedGitCommitSummaryDTO, IssueOutputDTO } from '../dto/generation/issue.dto';
import {
  ISSUE_LINKED_GIT_COMMIT_REPOSITORY,
  type IssueLinkedGitCommitRepository,
  type IssueLinkedGitCommitRow,
} from '../../domain/repositories/issue-linked-git-commit.repository';
import { CommitOutputDTO } from '../dto/generation/commit.dto';
import { CycleOutputDTO } from '../dto/generation/cycle.dto';
import { PaginationInputDTO, PaginationResult } from '~/application/common/dto/pagination.dto';
import { StoryStatus } from '../../domain/enums/story-status.enum';
import { StoryContentFormat } from '../../domain/enums/story-content-format.enum';
import { normalizeBpmnStoryDescription } from '../../domain/utils/bpmn-story-description.util';
import { EMPTY_BPMN_STORY_XML } from '../constants/empty-bpmn-story-xml';
import { DEFAULT_MERMAID_STORY_SOURCE } from '../constants/default-mermaid-story';
import { IssuePriority } from '../../domain/enums/issue-priority.enum';
import { IssueStatus } from '../../domain/enums/issue-status.enum';
import { ProjectStatus } from '../../domain/enums/project-status.enum';
import { CycleStatus } from '../../domain/enums/cycle-status.enum';
import { StoryDomainEntity } from '../../domain/entities/story.entity';
import { IssueDomainEntity } from '../../domain/entities/issue.entity';
import { CycleDomainEntity } from '../../domain/entities/cycle.entity';
import type { IStoryDatabaseData, IStoryMatrixRequirementAnnouncementEvent } from '../../domain/interfaces/story-database.interface';
import type { IIssueDatabaseData } from '../../domain/interfaces/issue-database.interface';
import type { ICycleDatabaseData } from '../../domain/interfaces/cycle-database.interface';
import { GenerateDocumentOptionsInputDTO } from '~/application/document/dto/generate-document-options-input.dto';
import { GeneratedDocumentDTO } from '~/application/document/dto/generated-document.dto';
import { GenerationMoneyInvestStatementGenerateDocumentInputDTO } from '~/application/document/documents-dto/generation-money-invest-statement-document.dto';
import { ProgramCapitalizationMoneyInvestStatementGenerateDocumentInputDTO } from '~/application/document/documents-dto/capitalization-program-money-invest-statement-document.dto';
import { CurrencyValidationUtil } from '~/utils/currency-validation.util';
import { DocumentInteractor } from '~/application/document/interactors/document.interactor';
import { Cooperative } from 'cooptypes';
import { InvestsManagementInteractor } from '../use-cases/invests-management.interactor';
import { IssuePermissionsService } from './issue-permissions.service';
import { PermissionsService } from './permissions.service';
import { TimeTrackingInteractor } from '../use-cases/time-tracking.interactor';
import { TIME_ENTRY_REPOSITORY, TimeEntryRepository } from '../../domain/repositories/time-entry.repository';
import { ProjectMapperService } from './project-mapper.service';
import { CommitMapperService } from './commit-mapper.service';
import type { MonoAccountDomainInterface } from '~/domain/account/interfaces/mono-account-domain.interface';
import {
  INTER_MATRIX_ROOM_MESSAGING,
  INTER_PROJECT_COMMUNICATION_ARTIFACTS,
  type InterMatrixRoomMessagingPort,
  type InterProjectCommunicationArtifactsPort,
} from '@coopenomics/inter';
import config from '~/config/config';
import { EMPTY_HASH } from '~/shared/utils/constants';

/**
 * Сервис уровня приложения для генерации в CAPITAL
 * Обрабатывает запросы от GenerationResolver
 */
@Injectable()
export class GenerationService {
  private readonly logger = new Logger(GenerationService.name);

  constructor(
    private readonly generationInteractor: GenerationInteractor,
    @Inject(STORY_REPOSITORY)
    private readonly storyRepository: StoryRepository,
    @Inject(ISSUE_REPOSITORY)
    private readonly issueRepository: IssueRepository,
    @Inject(PROJECT_REPOSITORY)
    private readonly projectRepository: ProjectRepository,
    @Inject(COMMIT_REPOSITORY)
    private readonly commitRepository: CommitRepository,
    @Inject(ISSUE_LINKED_GIT_COMMIT_REPOSITORY)
    private readonly issueLinkedGitCommitRepository: IssueLinkedGitCommitRepository,
    @Inject(TIME_ENTRY_REPOSITORY)
    private readonly timeEntryRepository: TimeEntryRepository,
    @Inject(CYCLE_REPOSITORY)
    private readonly cycleRepository: CycleRepository,
    private readonly issueIdGenerationService: IssueIdGenerationService,
    private readonly documentInteractor: DocumentInteractor,
    private readonly investsManagementInteractor: InvestsManagementInteractor,
    private readonly issuePermissionsService: IssuePermissionsService,
    private readonly permissionsService: PermissionsService,
    private readonly projectMapperService: ProjectMapperService,
    private readonly commitMapperService: CommitMapperService,
    private readonly timeTrackingInteractor: TimeTrackingInteractor,
    @Optional()
    @Inject(INTER_MATRIX_ROOM_MESSAGING)
    private readonly matrixRoomMessaging: InterMatrixRoomMessagingPort | undefined,
    @Optional()
    @Inject(INTER_PROJECT_COMMUNICATION_ARTIFACTS)
    private readonly projectCommArtifacts: InterProjectCommunicationArtifactsPort | undefined
  ) {}

  private rowsToLinkedCommitSummaries(rows: IssueLinkedGitCommitRow[]): IssueLinkedGitCommitSummaryDTO[] {
    const sorted = [...rows].sort((a, b) => b.committed_at.getTime() - a.committed_at.getTime());
    return sorted.map((r) => ({
      github_sha: r.github_sha,
      html_url: r.html_url,
      username: r.username,
      committed_at: r.committed_at,
      consumed: r.consumed_by_commit_hash != null,
      commit_message: r.commit_message ?? '',
    }));
  }

  private async withLinkedGitCommits<T extends { issue_hash: string }>(
    issue: T
  ): Promise<T & { linked_git_commits: IssueLinkedGitCommitSummaryDTO[] }> {
    const rows = await this.issueLinkedGitCommitRepository.findByIssueHash(issue.issue_hash);
    return { ...issue, linked_git_commits: this.rowsToLinkedCommitSummaries(rows) };
  }

  private async withLinkedGitCommitsBatch<T extends { issue_hash: string }>(
    issues: T[]
  ): Promise<Array<T & { linked_git_commits: IssueLinkedGitCommitSummaryDTO[] }>> {
    if (issues.length === 0) {
      return [];
    }
    const allRows = await this.issueLinkedGitCommitRepository.findByIssueHashes(
      issues.map((i) => i.issue_hash)
    );
    const byHash = new Map<string, IssueLinkedGitCommitRow[]>();
    for (const row of allRows) {
      const h = row.issue_hash.toLowerCase();
      const list = byHash.get(h);
      if (list) {
        list.push(row);
      } else {
        byHash.set(h, [row]);
      }
    }
    return issues.map((issue) => ({
      ...issue,
      linked_git_commits: this.rowsToLinkedCommitSummaries(byHash.get(issue.issue_hash.toLowerCase()) ?? []),
    }));
  }

  /**
   * Зачитываем fact только по задачам, у которых работа заведомо завершена или на ревью
   * (DONE/ON_REVIEW). Для активных/backlog-задач TimeEntry могут лежать как «предварительная оценка»
   * (estimate-записи создаются applyExplicitEstimateToTimeEntries сразу при выставлении estimate),
   * и считать их за факт неправильно. Остальные статусы получают fact=0.
   */
  private readonly FACTUAL_STATUSES: ReadonlySet<IssueStatus> = new Set([
    IssueStatus.DONE,
    IssueStatus.ON_REVIEW,
  ]);

  private async withFactBatch<T extends { issue_hash: string; status: IssueStatus }>(
    issues: T[]
  ): Promise<
    Array<
      T & {
        fact: number;
        fact_committed: number;
        fact_uncommitted: number;
        fact_by_contributor: Array<{ contributor_hash: string; hours: number }>;
      }
    >
  > {
    if (issues.length === 0) return [];
    const factualIssues = issues.filter((i) => this.FACTUAL_STATUSES.has(i.status));
    const factMap = factualIssues.length
      ? await this.timeEntryRepository.getFactByIssues(factualIssues.map((i) => i.issue_hash))
      : new Map();
    return issues.map((issue) => {
      const agg = this.FACTUAL_STATUSES.has(issue.status)
        ? factMap.get(issue.issue_hash.toLowerCase())
        : undefined;
      return {
        ...issue,
        fact: agg?.fact ?? 0,
        fact_committed: agg?.fact_committed ?? 0,
        fact_uncommitted: agg?.fact_uncommitted ?? 0,
        fact_by_contributor: agg?.fact_by_contributor ?? [],
      };
    });
  }

  private async withFact<T extends { issue_hash: string; status: IssueStatus }>(issue: T) {
    const [enriched] = await this.withFactBatch([issue]);
    return enriched;
  }


  /**
   * Создание коммита в CAPITAL контракте
   * Возвращает полный объект коммита с обогащенными данными
   */
  async createCommit(data: CreateCommitInputDTO, currentUser: MonoAccountDomainInterface): Promise<CommitOutputDTO> {
    const commitEntity = await this.generationInteractor.createCommit(data, currentUser);
    return await this.commitMapperService.toDTO(commitEntity, currentUser);
  }

  /**
   * Одобрение коммита в CAPITAL контракте
   */
  async approveCommit(data: CommitApproveInputDTO, currentUser: MonoAccountDomainInterface): Promise<CommitOutputDTO> {
    const domainInput: CommitApproveDomainInput = {
      ...data,
      master: currentUser.username,
    };

    const commitEntity = await this.generationInteractor.approveCommit(domainInput);
    return await this.commitMapperService.toDTO(commitEntity, currentUser);
  }

  /**
   * Отклонение коммита в CAPITAL контракте
   */
  async declineCommit(data: CommitDeclineInputDTO, currentUser: MonoAccountDomainInterface): Promise<CommitOutputDTO> {
    const domainInput: CommitDeclineDomainInput = {
      ...data,
      master: currentUser.username,
    };

    const commitEntity = await this.generationInteractor.declineCommit(domainInput);
    return await this.commitMapperService.toDTO(commitEntity, currentUser);
  }

  // ============ STORY METHODS ============

  /**
   * Создание истории
   */
  async createStory(data: CreateStoryInputDTO, currentUser: MonoAccountDomainInterface): Promise<StoryOutputDTO> {
    // Проверяем права доступа на создание требования
    if (data.project_hash) {
      // Получаем проект и проверяем права на создание требования
      const project = await this.projectRepository.findByHash(data.project_hash);
      if (!project) {
        throw new Error(`Проект с хешем ${data.project_hash} не найден`);
      }
      const projectPermissions = await this.permissionsService.calculateProjectPermissions(project, currentUser);
      if (!projectPermissions.can_create_requirement) {
        throw new Error('У вас нет прав на создание требований для этого проекта.');
      }
    } else if (data.issue_hash) {
      // Получаем задачу и проверяем права на создание требования
      const issue = await this.issueRepository.findByIssueHash(data.issue_hash);
      if (!issue) {
        throw new Error(`Задача с хешем ${data.issue_hash} не найдена`);
      }
      const issuePermissions = await this.permissionsService.calculateIssuePermissions(issue, currentUser);
      if (!issuePermissions.can_create_requirement) {
        throw new Error('У вас нет прав на создание требований для этой задачи.');
      }
    } else {
      // Если не указан ни проект, ни задача - это ошибка
      throw new Error('Требование должно быть привязано либо к проекту, либо к задаче');
    }

    const contentFormat = data.content_format ?? StoryContentFormat.MARKDOWN;
    let description = data.description != null ? data.description : undefined;

    if (contentFormat === StoryContentFormat.BPMN) {
      const trimmed = description?.trim();
      if (!trimmed) {
        description = EMPTY_BPMN_STORY_XML;
      }
    }
    if (contentFormat === StoryContentFormat.MERMAID) {
      const trimmed = description?.trim();
      if (!trimmed) {
        description = DEFAULT_MERMAID_STORY_SOURCE;
      }
    }
    if (
      description !== undefined &&
      (contentFormat === StoryContentFormat.BPMN || contentFormat === StoryContentFormat.DRAWIO)
    ) {
      description = normalizeBpmnStoryDescription(description, contentFormat) ?? description;
    }

    // Создаем данные для доменной сущности
    const storyDatabaseData: IStoryDatabaseData = {
      _id: '',
      story_hash: data.story_hash,
      coopname: data.coopname,
      title: data.title,
      description,
      content_format: contentFormat,
      status: data.status || StoryStatus.PENDING,
      project_hash: data.project_hash,
      // Нормализация: пустая строка или undefined преобразуется в undefined
      issue_hash: data.issue_hash && data.issue_hash.trim() !== '' ? data.issue_hash : undefined,
      created_by: currentUser.username, // Сохраняем username пользователя
      sort_order: data.sort_order || 0,
      block_num: 0,
      present: false,
    };

    // Создаем доменную сущность
    const storyEntity = new StoryDomainEntity(storyDatabaseData);

    // Сохраняем через репозиторий
    const savedStory = await this.storyRepository.create(storyEntity);

    void (async () => {
      try {
        const events = await this.publishNewStoryToProjectMatrixChats(savedStory, data.coopname);
        if (events.length === 0) {
          return;
        }
        const latest = await this.storyRepository.findByStoryHash(savedStory.story_hash);
        if (!latest) {
          return;
        }
        const patched = new StoryDomainEntity({
          ...this.storyDomainToDatabaseData(latest),
          matrix_requirement_announcement_events: events,
        });
        await this.storyRepository.update(patched);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Публикация ссылки на новое требование в Matrix: ${msg}`);
      }
    })();

    return savedStory;
  }

  private storyDomainToDatabaseData(story: StoryDomainEntity): IStoryDatabaseData {
    return {
      _id: story._id,
      story_hash: story.story_hash,
      coopname: story.coopname,
      title: story.title,
      description: story.description,
      content_format: story.content_format,
      status: story.status,
      project_hash: story.project_hash,
      issue_hash: story.issue_hash,
      created_by: story.created_by,
      sort_order: story.sort_order,
      block_num: story.block_num,
      present: story.present,
      _created_at: story._created_at,
      _updated_at: story._updated_at,
      matrix_requirement_announcement_events: story.matrix_requirement_announcement_events,
    };
  }

  /**
   * Текст анонса требования в Matrix: заголовок и ссылка на desktop (как при создании).
   */
  private async buildStoryMatrixAnnouncementPlainBody(
    story: StoryDomainEntity,
    coopname: string
  ): Promise<string | null> {
    let anchorProjectHash = story.project_hash?.trim() ?? '';
    if (!anchorProjectHash && story.issue_hash) {
      const issue = await this.issueRepository.findByIssueHash(story.issue_hash);
      anchorProjectHash = issue?.project_hash?.trim() ?? '';
    }
    if (!anchorProjectHash) {
      return null;
    }
    const project = await this.projectRepository.findByHash(anchorProjectHash);
    if (!project) {
      return null;
    }
    const pathPrefix = project.isComponent() ? 'components' : 'projects';
    const baseUrl = config.frontend_url.replace(/\/$/, '');
    const path = `/${encodeURIComponent(coopname)}/capital/${pathPrefix}/${encodeURIComponent(anchorProjectHash)}/requirements/${encodeURIComponent(story.story_hash)}`;
    const desktopUrl = `${baseUrl}/#${path}`;
    return [`${story.title}`, desktopUrl].join('\n');
  }

  /**
   * Ссылка на страницу требования в desktop (hash-router) и пост в комнату(ы) проекта в Matrix.
   */
  private async publishNewStoryToProjectMatrixChats(
    story: StoryDomainEntity,
    coopname: string
  ): Promise<IStoryMatrixRequirementAnnouncementEvent[]> {
    if (!this.matrixRoomMessaging || !this.projectCommArtifacts) {
      return [];
    }

    // Требования к задаче (issue_hash задан) видны только на странице задачи и не публикуются
    // в проектные/компонентные matrix-комнаты, чтобы не зашумлять основной канал проекта.
    if (story.issue_hash && story.issue_hash.trim() !== '') {
      return [];
    }

    const anchorProjectHash = story.project_hash?.trim() ?? '';
    if (!anchorProjectHash) {
      return [];
    }

    const projectForStory = await this.projectRepository.findByHash(anchorProjectHash);
    if (!projectForStory) {
      return [];
    }

    // Компоненты не имеют отдельных записей чатов в реестре: комната Matrix у корневого проекта (parent_hash).
    let matrixRoomProjectHash = anchorProjectHash.trim().toLowerCase();
    if (projectForStory.isComponent()) {
      const parentHash = projectForStory.parent_hash?.trim().toLowerCase() ?? '';
      if (parentHash) {
        matrixRoomProjectHash = parentHash;
      }
    }

    const rooms = await this.projectCommArtifacts.listCommunicationRoomsForProject(matrixRoomProjectHash);
    if (rooms.length === 0) {
      return [];
    }

    const body = await this.buildStoryMatrixAnnouncementPlainBody(story, coopname);
    if (!body) {
      return [];
    }

    const published: IStoryMatrixRequirementAnnouncementEvent[] = [];
    for (const room of rooms) {
      const eventId = await this.matrixRoomMessaging.sendTextMessageAndPin({
        matrixRoomId: room.matrixRoomId,
        plainTextBody: body,
      });
      published.push({ matrix_room_id: room.matrixRoomId, event_id: eventId });
    }
    return published;
  }

  /**
   * Удаление анонса требования из Matrix: снять закреп и redact корневого события.
   */
  private async removeStoryMatrixAnnouncements(refs: IStoryMatrixRequirementAnnouncementEvent[]): Promise<void> {
    if (!this.matrixRoomMessaging || !refs.length) {
      return;
    }
    for (const ref of refs) {
      try {
        await this.matrixRoomMessaging.unpinAndRedactAnnouncement({
          matrixRoomId: ref.matrix_room_id,
          rootEventId: ref.event_id,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(`Удаление анонса требования в Matrix (комната ${ref.matrix_room_id}): ${msg}`);
      }
    }
  }

  /**
   * После смены заголовка — правка текста закреплённых сообщений (если есть сохранённые event_id).
   */
  private async syncStoryMatrixAnnouncementAfterTitleChange(story: StoryDomainEntity, coopname: string): Promise<void> {
    if (!this.matrixRoomMessaging) {
      return;
    }
    const refs = story.matrix_requirement_announcement_events;
    if (!refs?.length) {
      return;
    }
    const body = await this.buildStoryMatrixAnnouncementPlainBody(story, coopname);
    if (!body) {
      return;
    }
    for (const ref of refs) {
      try {
        await this.matrixRoomMessaging.replaceTextMessage({
          matrixRoomId: ref.matrix_room_id,
          rootEventId: ref.event_id,
          plainTextBody: body,
        });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        this.logger.warn(
          `Обновление анонса требования в Matrix (комната ${ref.matrix_room_id}): ${msg}`
        );
      }
    }
  }

  /**
   * Проверка прав на изменение требования (story): по проекту или по задаче (итоговые якоря после merge полей).
   */
  private async assertCanEditStoryRequirement(
    anchor: { project_hash?: string | null; issue_hash?: string | null },
    currentUser?: MonoAccountDomainInterface
  ): Promise<void> {
    if (!currentUser?.username) {
      throw new Error('Требуется авторизация');
    }
    const projectHash = anchor.project_hash?.trim();
    if (projectHash) {
      const project = await this.projectRepository.findByHash(projectHash);
      if (!project) {
        throw new Error(`Проект с хэшем ${projectHash} не найден`);
      }
      const perms = await this.permissionsService.calculateProjectPermissions(project, currentUser);
      if (!perms.can_edit_requirement) {
        throw new Error('У вас нет прав на изменение этого требования.');
      }
      return;
    }
    const issueHash = anchor.issue_hash?.trim();
    if (issueHash) {
      const issue = await this.issueRepository.findByIssueHash(issueHash);
      if (!issue) {
        throw new Error(`Задача с хэшем ${issueHash} не найдена`);
      }
      const perms = await this.permissionsService.calculateIssuePermissions(issue, currentUser);
      if (!perms.can_edit_requirement) {
        throw new Error('У вас нет прав на изменение этого требования.');
      }
      return;
    }
    throw new Error('Требование не привязано ни к проекту, ни к задаче.');
  }

  /**
   * Проверка прав на удаление требования (story).
   */
  private async assertCanDeleteStoryRequirement(
    story: Pick<StoryDomainEntity, 'project_hash' | 'issue_hash'>,
    currentUser: MonoAccountDomainInterface
  ): Promise<void> {
    const projectHash = story.project_hash?.trim();
    if (projectHash) {
      const project = await this.projectRepository.findByHash(projectHash);
      if (!project) {
        throw new Error(`Проект с хэшем ${projectHash} не найден`);
      }
      const perms = await this.permissionsService.calculateProjectPermissions(project, currentUser);
      if (!perms.can_delete_requirement) {
        throw new Error('У вас нет прав на удаление этого требования.');
      }
      return;
    }
    const issueHash = story.issue_hash?.trim();
    if (issueHash) {
      const issue = await this.issueRepository.findByIssueHash(issueHash);
      if (!issue) {
        throw new Error(`Задача с хэшем ${issueHash} не найдена`);
      }
      const perms = await this.permissionsService.calculateIssuePermissions(issue, currentUser);
      if (!perms.can_delete_requirement) {
        throw new Error('У вас нет прав на удаление этого требования.');
      }
      return;
    }
    throw new Error('Требование не привязано ни к проекту, ни к задаче.');
  }

  /**
   * Обновление истории
   */
  async updateStory(data: UpdateStoryInputDTO, username: string, currentUser?: MonoAccountDomainInterface): Promise<StoryOutputDTO> {
    // Получаем существующую историю
    const existingStory = await this.storyRepository.findByStoryHash(data.story_hash);

    if (!existingStory) {
      throw new Error(`История с хэшем ${data.story_hash} не найдена`);
    }

    const mergedProjectHash = data.project_hash !== undefined ? data.project_hash : existingStory.project_hash;
    const mergedIssueHash = data.issue_hash !== undefined ? data.issue_hash : existingStory.issue_hash;
    await this.assertCanEditStoryRequirement(
      { project_hash: mergedProjectHash, issue_hash: mergedIssueHash },
      currentUser
    );

    // Определяем issue_hash с нормализацией
    const issueHash = data.issue_hash ?? existingStory.issue_hash;

    const nextContentFormat = data.content_format ?? existingStory.content_format;

    let nextDescription = existingStory.description;
    if (data.description !== undefined) {
      if (data.description === null) {
        nextDescription = undefined;
      } else if (
        nextContentFormat === StoryContentFormat.BPMN ||
        nextContentFormat === StoryContentFormat.DRAWIO
      ) {
        nextDescription =
          normalizeBpmnStoryDescription(data.description, nextContentFormat) ?? data.description;
      } else {
        nextDescription = data.description;
      }
    }

    const nextTitle = data.title ?? existingStory.title;
    const titleChanged = data.title !== undefined && data.title !== existingStory.title;

    // Создаем обновленные данные для доменной сущности
    const updatedStoryDatabaseData: IStoryDatabaseData = {
      _id: existingStory._id,
      story_hash: existingStory.story_hash,
      coopname: existingStory.coopname,
      title: nextTitle,
      description: nextDescription,
      content_format: nextContentFormat,
      status: data.status ?? existingStory.status,
      project_hash: data.project_hash ?? existingStory.project_hash,
      // Нормализация: пустая строка или undefined преобразуется в undefined
      issue_hash: issueHash && issueHash.trim() !== '' ? issueHash : undefined,
      created_by: existingStory.created_by,
      sort_order: data.sort_order ?? existingStory.sort_order,
      block_num: existingStory.block_num,
      present: existingStory.present,
      matrix_requirement_announcement_events: existingStory.matrix_requirement_announcement_events,
    };

    // Создаем доменную сущность с обновленными данными
    const storyEntity = new StoryDomainEntity(updatedStoryDatabaseData);

    // Сохраняем через репозиторий
    const updatedStory = await this.storyRepository.update(storyEntity);

    if (titleChanged) {
      void this.syncStoryMatrixAnnouncementAfterTitleChange(updatedStory, existingStory.coopname).catch(
        (err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err);
          this.logger.warn(`Синхронизация заголовка требования с Matrix: ${msg}`);
        }
      );
    }

    return updatedStory;
  }

  /**
   * Получение историй с фильтрацией
   */
  async getStories(filter?: StoryFilterInputDTO, options?: PaginationInputDTO): Promise<PaginationResult<StoryOutputDTO>> {
    // Если указан issue_hash, ищем только по конкретной задаче
    if (filter?.issue_hash) {
      const result = await this.storyRepository.findAllPaginated(filter, options);
      return {
        items: result.items as StoryOutputDTO[],
        totalCount: result.totalCount,
        currentPage: result.currentPage,
        totalPages: result.totalPages,
      };
    }

    // Если указан project_hash, применяем агрегацию
    if (filter?.project_hash) {
      // Определяем, нужно ли включать требования дочерних компонентов
      const showComponentsRequirements = filter.show_components_requirements !== false; // По умолчанию true

      // Задачные требования (story с issue_hash) живут только на странице задачи и не
      // аккумулируются на проект/компонент: дефолт false, явный true оставлен на случай
      // обратной потребности.
      const showIssuesRequirements = filter.show_issues_requirements === true;

      // Собираем все project_hash для фильтрации
      let projectHashesToFilter: string[] = [filter.project_hash];

      if (showComponentsRequirements) {
        // Получаем дочерние компоненты проекта
        try {
          const components = await this.projectRepository.findComponentsByParentHash(filter.project_hash);
          const componentHashes = components.map((component) => component.project_hash);
          projectHashesToFilter = projectHashesToFilter.concat(componentHashes);
        } catch (error) {
          console.warn(`Failed to fetch components for project ${filter.project_hash}`, { error });
          // Продолжаем с только родительским проектом
        }
      }

      // Собираем все issue_hash для фильтрации задач
      let issueHashesToFilter: string[] = [];

      if (showIssuesRequirements) {
        // Получаем все задачи для собранных проектов
        try {
          for (const projectHash of projectHashesToFilter) {
            const issues = await this.issueRepository.findByProjectHash(projectHash);
            const issueHashes = issues.map((issue) => issue.issue_hash);
            issueHashesToFilter = issueHashesToFilter.concat(issueHashes);
          }
        } catch (error) {
          console.warn(`Failed to fetch issues for projects ${projectHashesToFilter.join(', ')}`, { error });
          // Продолжаем без задач
        }
      }

      // Получаем все stories одним запросом
      const allStories = await this.storyRepository.findAllByProjectHashesAndIssueHashes(
        projectHashesToFilter,
        issueHashesToFilter
      );

      // Если задачные требования выключены, отфильтровываем stories с непустым issue_hash:
      // репозиторий выбирает по `project_hash IN (...) OR issue_hash IN (...)`, и stories,
      // привязанные к задачам, всё равно попадают через project_hash. Их нужно убрать здесь.
      const filteredStories = showIssuesRequirements
        ? allStories
        : allStories.filter((story) => !story.issue_hash || story.issue_hash.trim() === '');

      // Убираем дубликаты (на случай если одна история относится к нескольким проектам)
      const uniqueStories = filteredStories.filter(
        (story, index, self) => index === self.findIndex((s) => s.story_hash === story.story_hash)
      );

      // Сортируем по sort_order, затем по _created_at
      uniqueStories.sort((a, b) => {
        if (a.sort_order !== b.sort_order) {
          return a.sort_order - b.sort_order;
        }
        return 0; // _created_at уже отсортирован в findAll
      });

      // Применяем пагинацию
      const page = options?.page || 1;
      const limit = options?.limit || 10;
      const offset = (page - 1) * limit;
      const paginatedItems = uniqueStories.slice(offset, offset + limit);

      return {
        items: paginatedItems as StoryOutputDTO[],
        totalCount: uniqueStories.length,
        currentPage: page,
        totalPages: Math.ceil(uniqueStories.length / limit),
      };
    }

    // Для остальных случаев используем стандартную пагинацию
    const result = await this.storyRepository.findAllPaginated(filter, options);
    return {
      items: result.items as StoryOutputDTO[],
      totalCount: result.totalCount,
      currentPage: result.currentPage,
      totalPages: result.totalPages,
    };
  }

  /**
   * Получение истории по хэшу
   */
  async getStoryByHash(storyHash: string): Promise<StoryOutputDTO | null> {
    const storyEntity = await this.storyRepository.findByStoryHash(storyHash);
    return storyEntity ? (storyEntity as StoryOutputDTO) : null;
  }

  /**
   * Удаление истории по хэшу
   */
  async deleteStoryByHash(storyHash: string, currentUser: MonoAccountDomainInterface): Promise<boolean> {
    const storyEntity = await this.storyRepository.findByStoryHash(storyHash);
    if (!storyEntity) {
      throw new Error(`История с хэшем ${storyHash} не найдена`);
    }
    await this.assertCanDeleteStoryRequirement(storyEntity, currentUser);
    const matrixRefs = storyEntity.matrix_requirement_announcement_events ?? [];
    await this.storyRepository.delete(storyEntity._id);
    void this.removeStoryMatrixAnnouncements(matrixRefs);
    return true;
  }

  // ============ ISSUE METHODS ============

  /**
   * Создание задачи
   */
  async createIssue(
    data: CreateIssueInputDTO,
    username: string,
    currentUser?: MonoAccountDomainInterface
  ): Promise<IssueOutputDTO> {
    // Проверяем права на управление задачами
    const project = await this.projectRepository.findByHash(data.project_hash);
    if (!project) {
      throw new Error(`Проект с хэшем ${data.project_hash} не найден`);
    }
    const projectPermissions = await this.permissionsService.calculateProjectPermissions(project, currentUser);
    if (!projectPermissions.can_manage_issues) {
      throw new Error('У вас нет прав на управление задачами в этом проекте. Только мастер проекта может управлять задачами.');
    }

    // Проверяем права на установку начального статуса (как у сохранённой задачи):
    // submaster по умолчанию = первый creator — иначе проверка видит роль CREATOR без CHANGE_STATUS.
    const effectiveSubmasterForPermission
      = data.submaster ?? (data.creators?.length ? data.creators[0] : undefined);
    if (data.status) {
      await this.issuePermissionsService.validateIssueStatusPermission(
        username,
        data.coopname,
        data.project_hash,
        effectiveSubmasterForPermission,
        data.creators || [],
        data.status,
        IssueStatus.BACKLOG, // Для новой задачи текущий статус - BACKLOG
        currentUser?.role
      );
    }

    // Генерируем уникальный хэш для задачи
    const issueHash = generateUniqueHash();

    // Подготавливаем данные задачи без ID
    const issueDataWithoutId: Omit<IIssueDatabaseData, 'id'> = {
      _id: '',
      issue_hash: issueHash,
      coopname: data.coopname,
      title: data.title,
      description: data.description,
      priority: data.priority || IssuePriority.MEDIUM,
      status: data.status || IssueStatus.BACKLOG,
      estimate: data.estimate ?? 0,
      sort_order: data.sort_order || 0,
      created_by: username, // Сохраняем имя пользователя
      submaster: data.submaster || (data.creators && data.creators.length > 0 ? data.creators[0] : undefined),
      creators: data.creators || [],
      project_hash: data.project_hash,
      cycle_id: data.cycle_id,
      metadata: {
        labels: data.labels || [],
        attachments: data.attachments || [],
      },
      present: false,
    };

    // Генерируем ID + увеличиваем счетчик атомарно в проекте
    const { issueData, updatedProject } = this.issueIdGenerationService.generateIssueId(project, issueDataWithoutId);

    // Сохраняем обновленный проект с новым счетчиком
    await this.projectRepository.update(updatedProject);

    // Создаем доменную сущность с готовым ID
    const issueEntity = new IssueDomainEntity(issueData);

    // Если указан ответственный, используем метод доменной сущности для правильного назначения
    if (data.submaster) {
      issueEntity.setSubmaster(data.submaster);
    }

    // Сохраняем задачу через репозиторий
    const savedIssue = await this.issueRepository.create(issueEntity);

    if (data.estimate !== undefined && !hoursAlmostEqual(savedIssue.estimate ?? 0, 0)) {
      await this.timeTrackingInteractor.applyExplicitEstimateToTimeEntries(savedIssue);
    }

    // Рассчитываем права доступа для задачи
    const permissions = await this.permissionsService.calculateIssuePermissions(savedIssue, currentUser);

    const withLinks = await this.withLinkedGitCommits({
      ...savedIssue,
      permissions,
    });
    return this.withFact(withLinks);
  }

  /**
   * Перенос задачи в другой компонент того же проекта (общий родительский проект): одна строка в БД — обновляется project_hash (и cycle_id),
   * issue_hash и человекочитаемый id не меняются. Связанные time entries / stories / git-links — только смена project_hash.
   */
  async moveIssueToComponent(
    data: MoveCapitalIssueToComponentInputDTO,
    currentUser?: MonoAccountDomainInterface
  ): Promise<IssueOutputDTO> {
    const targetHash = data.target_project_hash.toLowerCase();
    const issue = await this.issueRepository.findByIssueHash(data.issue_hash);
    if (!issue) {
      throw new Error(`Задача с хэшем ${data.issue_hash} не найдена`);
    }
    if (issue.project_hash === targetHash) {
      throw new Error('Задача уже принадлежит выбранному компоненту');
    }

    const sourceProject = await this.projectRepository.findByHash(issue.project_hash);
    const targetProject = await this.projectRepository.findByHash(targetHash);
    if (!sourceProject || !targetProject) {
      throw new Error('Проект источника или проект назначения не найден');
    }
    if (!sourceProject.isComponent() || !targetProject.isComponent()) {
      throw new Error('Перенос возможен только между компонентами одного проекта');
    }

    const zeroParent = EMPTY_HASH;
    const sourceParent = (sourceProject.parent_hash ?? '').toLowerCase();
    const targetParent = (targetProject.parent_hash ?? '').toLowerCase();
    if (!sourceParent || sourceParent === zeroParent || sourceParent !== targetParent) {
      throw new Error('Компоненты должны иметь одного и того же родительского проекта');
    }

    const blockedForTransfer = new Set<ProjectStatus>([
      ProjectStatus.VOTING,
      ProjectStatus.RESULT,
      ProjectStatus.FINALIZED,
      ProjectStatus.CANCELLED,
      ProjectStatus.UNDEFINED,
    ]);
    if (blockedForTransfer.has(sourceProject.status)) {
      throw new Error('Нельзя переносить задачу из компонента на голосовании или из завершённого компонента');
    }
    if (blockedForTransfer.has(targetProject.status)) {
      throw new Error('Нельзя переносить задачу в компонент на голосовании или в завершённый компонент');
    }

    const sourcePerms = await this.permissionsService.calculateProjectPermissions(sourceProject, currentUser);
    const targetPerms = await this.permissionsService.calculateProjectPermissions(targetProject, currentUser);
    if (!sourcePerms.can_manage_issues || !targetPerms.can_manage_issues) {
      throw new Error('Недостаточно прав: нужны права мастера на оба компонента');
    }

    const hasCommitted = await this.timeEntryRepository.hasCommittedTimeByIssueHash(issue.issue_hash);
    if (hasCommitted) {
      throw new Error(
        'Перенос невозможен: по задаче уже зафиксировано время в коммитах CAPITAL. Можно переносить только задачи без участия в коммитах.'
      );
    }
    const hasConsumed = await this.issueLinkedGitCommitRepository.hasConsumedRowsByIssueHash(issue.issue_hash);
    if (hasConsumed) {
      throw new Error(
        'Перенос невозможен: привязанные Git-коммиты уже использованы при создании коммита CAPITAL.'
      );
    }

    const issueData: IIssueDatabaseData = {
      _id: issue._id,
      id: issue.id,
      issue_hash: issue.issue_hash,
      coopname: issue.coopname,
      title: issue.title,
      description: issue.description,
      priority: issue.priority,
      status: issue.status,
      estimate: issue.estimate ?? 0,
      sort_order: issue.sort_order,
      created_by: issue.created_by,
      creators: [...issue.creators],
      submaster: issue.submaster,
      project_hash: targetProject.project_hash.toLowerCase(),
      cycle_id: undefined,
      metadata: {
        labels: [...(issue.metadata?.labels ?? [])],
        attachments: [...(issue.metadata?.attachments ?? [])],
      },
      block_num: issue.block_num,
      present: issue.present,
      _created_at: issue._created_at,
      _updated_at: new Date(),
    };

    await this.timeEntryRepository.updateProjectHashByIssueHash(issue.issue_hash, targetProject.project_hash);
    await this.storyRepository.updateProjectHashByIssueHash(issue.issue_hash, targetProject.project_hash);
    await this.issueLinkedGitCommitRepository.updateProjectHashByIssueHash(issue.issue_hash, targetProject.project_hash);

    const moved = new IssueDomainEntity(issueData);
    const saved = await this.issueRepository.update(moved);
    const permissions = await this.permissionsService.calculateIssuePermissions(saved, currentUser);
    const withLinks = await this.withLinkedGitCommits({
      ...saved,
      permissions,
    });
    return this.withFact(withLinks);
  }

  /**
   * Обновление задачи
   */
  async updateIssue(
    data: UpdateIssueInputDTO,
    username: string,
    currentUser?: MonoAccountDomainInterface
  ): Promise<IssueOutputDTO> {
    // Получаем существующую задачу
    const existingIssue = await this.issueRepository.findByIssueHash(data.issue_hash);

    if (!existingIssue) {
      throw new Error(`Задача с хэшем ${data.issue_hash} не найдена`);
    }

    // Проверяем права на управление задачами
    const project = await this.projectRepository.findByHash(existingIssue.project_hash);
    if (!project) {
      throw new Error(`Проект с хэшем ${existingIssue.project_hash} не найден`);
    }
    const projectPermissions = await this.permissionsService.calculateProjectPermissions(project, currentUser);

    // Рассчитываем права доступа для конкретной задачи
    const issuePermissions = await this.permissionsService.calculateIssuePermissions(existingIssue, currentUser);

    // Проверяем права на управление задачами в проекте (мастер проекта) или на редактирование конкретной задачи (исполнитель)
    if (!projectPermissions.can_manage_issues && !issuePermissions.can_edit_issue) {
      throw new Error('У вас нет прав на редактирование этой задачи. Только мастер проекта или исполнитель задачи могут изменять её.');
    }

    // Проверяем права на назначение ответственного
    if (data.submaster !== undefined && data.submaster !== existingIssue.submaster) {
      await this.issuePermissionsService.validateSubmasterAssignmentPermission(
        username,
        existingIssue.coopname,
        existingIssue.project_hash
      );
    }

    // Проверяем права на изменение статуса задачи
    if (data.status !== undefined) {
      await this.issuePermissionsService.validateIssueStatusPermission(
        username,
        existingIssue.coopname,
        existingIssue.project_hash,
        existingIssue.submaster,
        existingIssue.creators,
        data.status,
        existingIssue.status,
        currentUser?.role
      );
    }

    // Завершённая задача: нельзя менять estimate (идемичное значение через hoursAlmostEqual — можно)
    if (existingIssue.status === IssueStatus.DONE && data.estimate !== undefined) {
      if (!hoursAlmostEqual(data.estimate ?? 0, existingIssue.estimate ?? 0)) {
        throw new Error(
          'Нельзя изменять оценку (estimate) у задачи в статусе «Выполнена». Допустимо передать только то же значение.'
        );
      }
    }

    // Проверяем права на установку оценки (estimate)
    if (data.estimate !== undefined && !hoursAlmostEqual(data.estimate, existingIssue.estimate)) {
      await this.issuePermissionsService.validateEstimateSettingPermission(
        username,
        existingIssue.coopname,
        existingIssue.project_hash,
        existingIssue.submaster,
        existingIssue.creators,
        currentUser?.role
      );
    }

    // Проверяем права на установку приоритета
    if (data.priority !== undefined && data.priority !== existingIssue.priority) {
      await this.issuePermissionsService.validatePrioritySettingPermission(
        username,
        existingIssue.coopname,
        existingIssue.project_hash,
        existingIssue.submaster,
        existingIssue.creators,
        currentUser?.role
      );
    }
    // Создаем обновленные данные для доменной сущности
    const updatedIssueDatabaseData: IIssueDatabaseData = {
      _id: existingIssue._id,
      id: existingIssue.id,
      issue_hash: existingIssue.issue_hash,
      coopname: existingIssue.coopname,
      title: data.title ?? existingIssue.title,
      description: data.description ?? existingIssue.description,
      priority: data.priority ?? existingIssue.priority,
      status: data.status ?? existingIssue.status,
      estimate: data.estimate ?? existingIssue.estimate,
      sort_order: data.sort_order ?? existingIssue.sort_order,
      created_by: existingIssue.created_by, // Сохраняем существующее значение created_by (username)
      submaster: data.submaster ?? (data.creators && data.creators.length > 0 ? data.creators[0] : existingIssue.submaster),
      creators: data.creators ?? existingIssue.creators,
      project_hash: existingIssue.project_hash,
      cycle_id: data.cycle_id ?? existingIssue.cycle_id,
      metadata: {
        labels: data.labels ?? existingIssue.metadata.labels,
        attachments: data.attachments ?? existingIssue.metadata.attachments,
      },
      present: existingIssue.present,
    };
    // Создаем доменную сущность с обновленными данными
    const issueEntity = new IssueDomainEntity(updatedIssueDatabaseData);

    // Если изменился ответственный, используем метод доменной сущности для правильного обновления
    if (data.submaster !== undefined && data.submaster !== existingIssue.submaster) {
      issueEntity.setSubmaster(data.submaster);
    }

    // Если переданы creators, обновляем их через доменный метод
    if (data.creators !== undefined) {
      issueEntity.setCreators(data.creators);
    }

    // Сохраняем через репозиторий
    const updatedIssue = await this.issueRepository.update(issueEntity);

    const estimateChanged =
      data.estimate !== undefined &&
      !hoursAlmostEqual(existingIssue.estimate ?? 0, updatedIssue.estimate ?? 0);
    const creatorsChanged =
      data.creators !== undefined &&
      !this.creatorsSetEquals(existingIssue.creators ?? [], updatedIssue.creators ?? []);

    if (estimateChanged || creatorsChanged) {
      await this.timeTrackingInteractor.applyExplicitEstimateToTimeEntries(updatedIssue);
    }

    // Рассчитываем права доступа для задачи
    const permissions = await this.permissionsService.calculateIssuePermissions(updatedIssue, currentUser);

    const withLinks = await this.withLinkedGitCommits({
      ...updatedIssue,
      permissions,
    });
    return this.withFact(withLinks);
  }

  /**
   * Получение задач с фильтрацией
   */
  async getIssues(
    filter?: IssueFilterInputDTO,
    options?: PaginationInputDTO,
    currentUser?: MonoAccountDomainInterface
  ): Promise<PaginationResult<IssueOutputDTO>> {
    // Получаем результат с пагинацией из домена
    const result = await this.issueRepository.findAllPaginated(filter, options);

    // Рассчитываем права доступа для всех задач пакетно
    const permissionsMap = await this.permissionsService.calculateBatchIssuePermissions(result.items, currentUser);

    // Обогащаем задачи правами доступа
    const itemsWithPermissions = result.items.map((issue) => {
      const permissions = permissionsMap.get(issue.issue_hash);
      return {
        ...issue,
        permissions,
      };
    });

    const withLinks = await this.withLinkedGitCommitsBatch(itemsWithPermissions);
    const items = await this.withFactBatch(withLinks);

    return {
      items,
      totalCount: result.totalCount,
      currentPage: result.currentPage,
      totalPages: result.totalPages,
    };
  }

  /**
   * Получение задачи по ID
   */
  async getIssueById(data: GetIssueByIdInputDTO, currentUser?: MonoAccountDomainInterface): Promise<IssueOutputDTO | null> {
    const issueEntity = await this.issueRepository.findById(data.id);

    if (!issueEntity) {
      return null;
    }

    // Рассчитываем права доступа для задачи
    const permissions = await this.permissionsService.calculateIssuePermissions(issueEntity, currentUser);

    // Возвращаем задачу с правами доступа и фактом
    const withLinks = await this.withLinkedGitCommits({
      ...issueEntity,
      permissions,
    });
    return this.withFact(withLinks);
  }

  /**
   * Получение задачи по хэшу
   */
  async getIssueByHash(issueHash: string, currentUser?: MonoAccountDomainInterface): Promise<IssueOutputDTO | null> {
    const issueEntity = await this.issueRepository.findByIssueHash(issueHash);

    if (!issueEntity) {
      return null;
    }

    // Рассчитываем права доступа для задачи
    const permissions = await this.permissionsService.calculateIssuePermissions(issueEntity, currentUser);

    const withLinks = await this.withLinkedGitCommits({
      ...issueEntity,
      permissions,
    });
    return this.withFact(withLinks);
  }

  /**
   * Удаление задачи по хэшу
   */
  async deleteIssueByHash(issueHash: string): Promise<boolean> {
    const issueEntity = await this.issueRepository.findByIssueHash(issueHash);
    if (!issueEntity) {
      throw new Error(`Задача с хэшем ${issueHash} не найдена`);
    }
    // Снимаем незакоммиченные билеты до удаления задачи — иначе они останутся сиротами
    // и исказят total_uncommitted_hours/pending_hours. Закоммиченные часы уже в экономике,
    // их не трогаем.
    await this.timeTrackingInteractor.cleanupIssueTimeEntries(issueHash);
    await this.issueRepository.delete(issueEntity._id);
    return true;
  }

  // ============ COMMIT METHODS ============

  /**
   * Получение коммитов с фильтрацией
   */
  async getCommits(
    filter?: CommitFilterInputDTO,
    options?: PaginationInputDTO,
    currentUser?: MonoAccountDomainInterface
  ): Promise<PaginationResult<CommitOutputDTO>> {
    // Получаем результат с пагинацией из домена
    const result = await this.commitRepository.findAllPaginated(filter, options);

    // Обогащаем коммиты через mapper
    const itemsWithProjects = await this.commitMapperService.toDTOBatch(result.items, currentUser);

    // Конвертируем результат в DTO
    return {
      items: itemsWithProjects,
      totalCount: result.totalCount,
      currentPage: result.currentPage,
      totalPages: result.totalPages,
    };
  }

  /**
   * Получение коммита по ID
   */
  async getCommitById(
    data: GetCommitByIdInputDTO,
    currentUser?: MonoAccountDomainInterface
  ): Promise<CommitOutputDTO | null> {
    const commitEntity = await this.commitRepository.findById(data.id);
    return commitEntity ? await this.commitMapperService.toDTO(commitEntity, currentUser) : null;
  }

  /**
   * Получение коммита по хэшу
   */
  async getCommitByHash(commitHash: string, currentUser?: MonoAccountDomainInterface): Promise<CommitOutputDTO | null> {
    const commitEntity = await this.commitRepository.findByCommitHash(commitHash);
    return commitEntity ? await this.commitMapperService.toDTO(commitEntity, currentUser) : null;
  }

  // ============ CYCLE METHODS ============

  /**
   * Создание цикла
   */
  async createCycle(data: CreateCycleInputDTO): Promise<CycleOutputDTO> {
    // Создаем данные для доменной сущности
    const cycleDatabaseData: ICycleDatabaseData = {
      _id: '',
      name: data.name,
      start_date: new Date(data.start_date),
      end_date: new Date(data.end_date),
      status: data.status || CycleStatus.FUTURE,
      present: false,
    };

    // Создаем доменную сущность
    const cycleEntity = new CycleDomainEntity(cycleDatabaseData);

    // Сохраняем через репозиторий
    const savedCycle = await this.cycleRepository.create(cycleEntity);
    return savedCycle;
  }

  /**
   * Получение циклов с фильтрацией
   */
  async getCycles(filter?: CycleFilterInputDTO, options?: PaginationInputDTO): Promise<PaginationResult<CycleOutputDTO>> {
    // Получаем результат с пагинацией из домена
    const result = await this.cycleRepository.findAllPaginated(filter, options);

    // Конвертируем результат в DTO
    return {
      items: result.items as CycleOutputDTO[],
      totalCount: result.totalCount,
      currentPage: result.currentPage,
      totalPages: result.totalPages,
    };
  }

  // ============ МЕТОДЫ ГЕНЕРАЦИИ ДОКУМЕНТОВ ============

  /**
   * Генерация заявления об инвестировании в генерацию
   */
  async generateGenerationMoneyInvestStatement(
    data: GenerationMoneyInvestStatementGenerateDocumentInputDTO,
    options: GenerateDocumentOptionsInputDTO,
    currentUser: MonoAccountDomainInterface
  ): Promise<GeneratedDocumentDTO> {
    // Подготавливаем данные через интерактор
    const enrichedData = await this.investsManagementInteractor.prepareGenerationMoneyInvestStatementData(data, currentUser);

    const document = await this.documentInteractor.generateDocument({
      data: {
        ...enrichedData,
        registry_id: Cooperative.Registry.GenerationMoneyInvestStatement.registry_id,
      },
      options,
    });
    return document as GeneratedDocumentDTO;
  }

  /**
   * Заявление об инвестировании в программу благороста (реестр 1030), без проекта
   */
  async generateProgramMoneyInvestStatement(
    data: ProgramCapitalizationMoneyInvestStatementGenerateDocumentInputDTO,
    options: GenerateDocumentOptionsInputDTO
  ): Promise<GeneratedDocumentDTO> {
    CurrencyValidationUtil.validateCurrencySymbol(data.amount, 'сумме инвестирования');

    const document = await this.documentInteractor.generateDocument({
      data: {
        ...data,
        registry_id: Cooperative.Registry.CapitalizationMoneyInvestStatement.registry_id,
      },
      options,
    });
    return document as GeneratedDocumentDTO;
  }

  private creatorsSetEquals(a: string[], b: string[]): boolean {
    if (a.length !== b.length) return false;
    const setA = new Set(a);
    for (const item of b) {
      if (!setA.has(item)) return false;
    }
    return true;
  }

}
