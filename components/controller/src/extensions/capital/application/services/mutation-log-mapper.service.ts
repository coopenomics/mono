import { Injectable, Inject } from '@nestjs/common';
import { LogEventType } from '../../domain/enums/log-event-type.enum';
import { IssuePriority } from '../../domain/enums/issue-priority.enum';
import { IssueStatus } from '../../domain/enums/issue-status.enum';
import { ISSUE_REPOSITORY, IssueRepository } from '../../domain/repositories/issue.repository';
import { PROJECT_REPOSITORY, ProjectRepository } from '../../domain/repositories/project.repository';
import { STORY_REPOSITORY, StoryRepository } from '../../domain/repositories/story.repository';
import { ACCOUNT_PORT, type IAccountPort,
  type InnerMutationLogEntry,
} from '@coopenomics/innercoop';
import { t } from '../../i18n';

/**
 * Типы сущностей для логов
 */
export enum LogEntityType {
  PROJECT = 'project',
  ISSUE = 'issue',
  STORY = 'story',
  CYCLE = 'cycle',
  CONTRIBUTOR = 'contributor',
  PROGRAM = 'program',
}

/**
 * Интерфейс для преобразованного лога
 */
export interface IMappedCapitalLog {
  _id: string;
  coopname: string;
  project_hash?: string;
  entity_type: LogEntityType;
  entity_id?: string;
  event_type: LogEventType;
  initiator: string;
  /** ФИО инициатора (fallback — username) */
  actor_name: string;
  /** Краткий заголовок действия без «Пайщик …» */
  title: string;
  /** Детали: суммы, изменения, контекст */
  description?: string;
  reference_id?: string;
  metadata?: Record<string, any>;
  /** Полная фраза для совместимости: «ФИО — заголовок» + description */
  message: string;
  created_at: Date;
}

type EventPayload = {
  title: string;
  description?: string;
  metadata?: Record<string, any>;
  reference_id?: string;
};

/**
 * Сервис для преобразования логов мутаций в логи событий capital.
 * Сообщения собираются на лету (mutation_logs хранит только args).
 */
@Injectable()
export class MutationLogMapperService {
  /** Кэш ФИО на время одного mapMultiple / mapToCapitalLog */
  private nameCache = new Map<string, string>();

  constructor(
    @Inject(ISSUE_REPOSITORY)
    private readonly issueRepository: IssueRepository,
    @Inject(PROJECT_REPOSITORY)
    private readonly projectRepository: ProjectRepository,
    @Inject(STORY_REPOSITORY)
    private readonly storyRepository: StoryRepository,
    @Inject(ACCOUNT_PORT)
    private readonly accountDataPort: IAccountPort
  ) {}

  /**
   * Формат суммы для UI: truncate 2 знака + группировка (1 000,00 RUB).
   */
  private formatMoney(asset?: string | null): string {
    if (!asset || typeof asset !== 'string') return '0,00';
    const parts = asset.trim().split(/\s+/);
    const raw = (parts[0] || '').replace(/[^\d.-]/g, '');
    const symbol = parts[1] || '';
    if (!raw || raw === '-' || Number.isNaN(Number.parseFloat(raw))) {
      return symbol ? `0,00 ${symbol}` : '0,00';
    }
    const negative = raw.startsWith('-');
    const abs = negative ? raw.slice(1) : raw;
    const [intPartRaw, decPartRaw = ''] = abs.split('.');
    const intPart = intPartRaw || '0';
    const decPart = decPartRaw.padEnd(2, '0').slice(0, 2);
    const intGrouped = new Intl.NumberFormat('ru-RU').format(BigInt(intPart));
    const formatted = `${negative ? '-' : ''}${intGrouped},${decPart}`;
    return symbol ? `${formatted} ${symbol}` : formatted;
  }

  private person(username?: string | null): string {
    if (!username) return t('capital.mutationLogMapper.person.unknown');
    return this.nameCache.get(username) || username;
  }

  private async resolveNames(usernames: string[]): Promise<void> {
    const unique = [...new Set(usernames.filter(Boolean))];
    await Promise.all(
      unique.map(async (username) => {
        if (this.nameCache.has(username)) return;
        try {
          const name = await this.accountDataPort.getDisplayName(username);
          this.nameCache.set(username, name || username);
        } catch {
          this.nameCache.set(username, username);
        }
      })
    );
  }

  private collectUsernamesFromLog(mutationLog: InnerMutationLogEntry): string[] {
    const args = mutationLog.arguments || {};
    const data = args.data || args.input || args || {};
    const names: string[] = [mutationLog.username];
    for (const key of ['master', 'author', 'username', 'contributor', 'voter', 'submaster']) {
      if (typeof data[key] === 'string') names.push(data[key]);
    }
    if (Array.isArray(data.creators)) {
      names.push(...data.creators.filter((c: unknown) => typeof c === 'string'));
    }
    return names;
  }

  private event(
    actorUsername: string,
    title: string,
    opts?: { description?: string; metadata?: Record<string, any>; reference_id?: string }
  ): EventPayload & { actor_name: string; message: string } {
    const actor_name = this.person(actorUsername);
    const description = opts?.description;
    const message = description
      ? `${actor_name} — ${title}. ${description}`
      : `${actor_name} — ${title}`;
    return {
      title,
      description,
      actor_name,
      message,
      metadata: opts?.metadata,
      reference_id: opts?.reference_id,
    };
  }

  private async getProjectInfo(data: any): Promise<{ title: string; entityType: string; isComponent: boolean }> {
    const isComponent =
      data.parent_hash && data.parent_hash !== '0000000000000000000000000000000000000000000000000000000000000000';

    let title = data.title || (isComponent ? t('capital.mutationLogMapper.entityFallbackTitle.component') : t('capital.mutationLogMapper.entityFallbackTitle.project'));
    if (data.project_hash) {
      try {
        const project = await this.projectRepository.findByHash(data.project_hash);
        if (project?.title) title = project.title;
        // parent_hash из БД точнее для старых мутаций без parent_hash в args
        if (project && !data.parent_hash && project.parent_hash) {
          const ph = project.parent_hash;
          if (ph && ph !== '0000000000000000000000000000000000000000000000000000000000000000') {
            return { title, entityType: t('capital.mutationLogMapper.entityType.component'), isComponent: true };
          }
        }
      } catch (error) {
        console.warn(`Failed to load project title for hash ${data.project_hash}:`, error);
      }
    }

    return { title, entityType: isComponent ? t('capital.mutationLogMapper.entityType.component') : t('capital.mutationLogMapper.entityType.project'), isComponent: !!isComponent };
  }

  private readonly mutationToEventType: Record<string, LogEventType> = {
    capitalCreateProject: LogEventType.PROJECT_CREATED,
    capitalEditProject: LogEventType.PROJECT_EDITED,
    capitalSetMaster: LogEventType.PROJECT_MASTER_ASSIGNED,
    capitalAddAuthor: LogEventType.AUTHOR_ADDED,
    capitalSetPlan: LogEventType.PROJECT_PLAN_SET,
    capitalStartProject: LogEventType.PROJECT_STARTED,
    capitalOpenProject: LogEventType.PROJECT_OPENED,
    capitalCloseProject: LogEventType.PROJECT_CLOSED,
    capitalStopProject: LogEventType.PROJECT_STOPPED,
    capitalDeleteProject: LogEventType.PROJECT_DELETED,
    capitalRegisterContributor: LogEventType.CONTRIBUTOR_REGISTERED,
    capitalImportContributor: LogEventType.CONTRIBUTOR_IMPORTED,
    capitalMakeClearance: LogEventType.CONTRIBUTOR_JOINED,
    capitalEditContributor: LogEventType.CONTRIBUTOR_EDITED,
    capitalCreateProjectInvest: LogEventType.INVESTMENT_RECEIVED,
    capitalCreateProgramInvest: LogEventType.PROGRAM_INVESTMENT_RECEIVED,
    capitalAllocateFunds: LogEventType.FUNDS_ALLOCATED,
    capitalCreateProjectProperty: LogEventType.PROJECT_PROPERTY_RECEIVED,
    capitalCreateProgramProperty: LogEventType.PROGRAM_PROPERTY_RECEIVED,
    capitalCreateCommit: LogEventType.COMMIT_RECEIVED,
    capitalRefreshSegment: LogEventType.SEGMENT_REFRESHED,
    capitalCreateDebt: LogEventType.DEBT_CREATED,
    capitalCreateExpense: LogEventType.EXPENSE_CREATED,
    capitalExpandExpenses: LogEventType.EXPENSES_EXPANDED,
    capitalFundProject: LogEventType.PROJECT_FUNDED,
    capitalRefreshProject: LogEventType.PROJECT_REFRESHED,
    capitalFundProgram: LogEventType.PROGRAM_FUNDED,
    capitalRefreshProgram: LogEventType.PROGRAM_REFRESHED,
    capitalStartVoting: LogEventType.VOTING_STARTED,
    capitalSubmitVote: LogEventType.VOTE_SUBMITTED,
    capitalCompleteVoting: LogEventType.VOTING_COMPLETED,
    capitalCalculateVotes: LogEventType.VOTES_CALCULATED,
    capitalPushResult: LogEventType.RESULT_PUSHED,
    capitalConvertSegment: LogEventType.SEGMENT_CONVERTED,
    capitalGenerateGenerationConvertStatement: LogEventType.PROJECT_WITHDRAWAL,
    capitalGenerateCapitalizationToMainWalletConvertStatement: LogEventType.PROGRAM_WITHDRAWAL,
    capitalCreateStory: LogEventType.STORY_CREATED,
    capitalUpdateStory: LogEventType.STORY_UPDATED,
    capitalDeleteStory: LogEventType.STORY_DELETED,
    capitalCreateIssue: LogEventType.ISSUE_CREATED,
    capitalUpdateIssue: LogEventType.ISSUE_UPDATED,
    capitalDeleteIssue: LogEventType.ISSUE_DELETED,
    capitalCreateCycle: LogEventType.CYCLE_CREATED,
  };

  getCapitalMutationNames(): string[] {
    return Object.keys(this.mutationToEventType);
  }

  getMutationNamesForLogging(): string[] {
    return Object.keys(this.mutationToEventType);
  }

  isCapitalMutation(mutationName: string): boolean {
    return mutationName in this.mutationToEventType;
  }

  private async determineEntityInfo(
    eventType: LogEventType,
    data: any
  ): Promise<{
    entity_type: LogEntityType;
    entity_id?: string;
    project_hash?: string;
  }> {
    switch (eventType) {
      // Проектные события
      case LogEventType.PROJECT_CREATED:
      case LogEventType.PROJECT_EDITED:
      case LogEventType.PROJECT_MASTER_ASSIGNED:
      case LogEventType.PROJECT_PLAN_SET:
      case LogEventType.PROJECT_STARTED:
      case LogEventType.PROJECT_OPENED:
      case LogEventType.PROJECT_CLOSED:
      case LogEventType.PROJECT_STOPPED:
      case LogEventType.PROJECT_DELETED:
      case LogEventType.PROJECT_FUNDED:
      case LogEventType.PROJECT_REFRESHED:
      case LogEventType.FUNDS_ALLOCATED:
      case LogEventType.FUNDS_DEALLOCATED:
      case LogEventType.PROJECT_PROPERTY_RECEIVED:
      case LogEventType.VOTING_STARTED:
      case LogEventType.VOTING_COMPLETED:
      case LogEventType.VOTES_CALCULATED:
        return {
          entity_type: LogEntityType.PROJECT,
          entity_id: data.project_hash,
          project_hash: data.project_hash,
        };

      // События по задачам
      case LogEventType.ISSUE_CREATED:
      case LogEventType.ISSUE_UPDATED:
      case LogEventType.ISSUE_DELETED:
        return {
          entity_type: LogEntityType.ISSUE,
          entity_id: data.issue_hash || data.issue_id || data.id,
          project_hash: data.project_hash,
        };

      // События по историям (stories)
      case LogEventType.STORY_CREATED:
      case LogEventType.STORY_UPDATED:
      case LogEventType.STORY_DELETED: {
        // Stories могут быть привязаны к проектам или к задачам
        // Извлекаем информацию о Story из базы для определения принадлежности
        let storyBelongsToIssue = false;
        let storyProjectHash = data.project_hash;
        let storyIssueHash = data.issue_id; // В данных мутации может быть issue_hash

        if (data.story_hash) {
          try {
            const story = await this.storyRepository.findByStoryHash(data.story_hash);
            if (story) {
              storyBelongsToIssue = !!story.issue_hash;
              storyProjectHash = story.project_hash;
              storyIssueHash = story.issue_hash;
            }
          } catch (error) {
            console.warn(`Failed to load story for entity info ${data.story_hash}:`, error);
          }
        }

        if (storyBelongsToIssue && storyIssueHash) {
          // Story принадлежит задаче - используем issue_hash как entity_id для фильтрации
          return {
            entity_type: LogEntityType.STORY,
            entity_id: storyIssueHash, // issue_hash для фильтрации по задаче
            project_hash: storyProjectHash,
          };
        } else if (storyProjectHash) {
          // Story принадлежит проекту
          return {
            entity_type: LogEntityType.STORY,
            entity_id: data.story_hash,
            project_hash: storyProjectHash,
          };
        }
        return {
          entity_type: LogEntityType.STORY,
          entity_id: data.story_hash,
          project_hash: undefined,
        };
      }

      // События по циклам
      case LogEventType.CYCLE_CREATED:
        return {
          entity_type: LogEntityType.CYCLE,
          entity_id: data.cycle_id || data.id,
          project_hash: data.project_hash,
        };

      // События по участникам
      case LogEventType.CONTRIBUTOR_REGISTERED:
      case LogEventType.CONTRIBUTOR_IMPORTED:
      case LogEventType.CONTRIBUTOR_JOINED:
      case LogEventType.CONTRIBUTOR_EDITED:
        return {
          entity_type: LogEntityType.CONTRIBUTOR,
          entity_id: data.username || data.contributor_hash,
          project_hash: data.project_hash,
        };

      // Программные события
      case LogEventType.PROGRAM_INVESTMENT_RECEIVED:
      case LogEventType.PROGRAM_PROPERTY_RECEIVED:
      case LogEventType.PROGRAM_FUNDED:
      case LogEventType.PROGRAM_REFRESHED:
      case LogEventType.PROGRAM_WITHDRAWAL:
        return {
          entity_type: LogEntityType.PROGRAM,
          entity_id: undefined,
          project_hash: undefined,
        };

      // Остальные события
      default:
        return {
          entity_type: LogEntityType.PROJECT,
          entity_id: data.project_hash,
          project_hash: data.project_hash,
        };
    }
  }


  /**
   * Преобразование лога мутации в лог события capital
   */
  async mapToCapitalLog(mutationLog: InnerMutationLogEntry): Promise<IMappedCapitalLog | null> {
    const eventType = this.mutationToEventType[mutationLog.mutation_name];
    if (!eventType) return null;

    await this.resolveNames(this.collectUsernamesFromLog(mutationLog));

    const args = mutationLog.arguments;
    const data = args.data || args.input || args;
    const coopname = data.coopname || mutationLog.coopname || '';
    const initiator = mutationLog.username;

    const { entity_type, entity_id, project_hash } = await this.determineEntityInfo(eventType, data);
    const messageData = await this.generateMessageAndMetadata(eventType, initiator, data);
    if (!messageData) return null;

    return {
      _id: mutationLog._id,
      coopname,
      project_hash,
      entity_type,
      entity_id,
      event_type: eventType,
      initiator,
      actor_name: messageData.actor_name,
      title: messageData.title,
      description: messageData.description,
      reference_id: messageData.reference_id,
      metadata: messageData.metadata,
      message: messageData.message,
      created_at: mutationLog.created_at,
    };
  }

  private async generateMessageAndMetadata(
    eventType: LogEventType,
    initiator: string,
    data: any
  ): Promise<(EventPayload & { actor_name: string; message: string }) | null> {
    switch (eventType) {
      case LogEventType.PROJECT_CREATED: {
        const isComponent =
          data.parent_hash && data.parent_hash !== '0000000000000000000000000000000000000000000000000000000000000000';
        const title = data.title || t('capital.mutationLogMapper.fallbackTitle.untitled');
        return this.event(
          initiator,
          isComponent ? t('capital.mutationLogMapper.projectCreated.component', { title }) : t('capital.mutationLogMapper.projectCreated.project', { title }),
          {
            metadata: { title, parent_hash: data.parent_hash, is_component: !!isComponent },
            reference_id: data.project_hash,
          }
        );
      }

      case LogEventType.PROJECT_EDITED: {
        const { title, entityType, isComponent } = await this.getProjectInfo(data);
        const changes: string[] = [];
        if (data.title !== undefined) changes.push(t('capital.mutationLogMapper.change.title', { title: data.title }));
        if (data.description !== undefined) changes.push(t('capital.mutationLogMapper.change.descriptionUpdated'));
        return this.event(initiator, t('capital.mutationLogMapper.projectEdited.main', { entityType, title }), {
          description: changes.length ? changes.join('; ') : undefined,
          metadata: { title, is_component: isComponent, changes },
          reference_id: data.project_hash,
        });
      }

      case LogEventType.PROJECT_MASTER_ASSIGNED: {
        const { title, entityType, isComponent } = await this.getProjectInfo(data);
        const master = data.master || data.username || '';
        return this.event(initiator, t('capital.mutationLogMapper.masterAssigned.main', { entityType, title }), {
          description: this.person(master),
          metadata: { master, title, is_component: isComponent },
          reference_id: data.project_hash,
        });
      }

      case LogEventType.AUTHOR_ADDED: {
        const author = data.author || data.username || '';
        return this.event(initiator, t('capital.mutationLogMapper.authorAdded.main'), {
          description: this.person(author),
          metadata: { author },
          reference_id: data.project_hash,
        });
      }

      case LogEventType.PROJECT_PLAN_SET: {
        const { title, entityType, isComponent } = await this.getProjectInfo(data);
        const planHours = data.plan_creators_hours || 0;
        const planExpenses = this.formatMoney(data.plan_expenses || '0 RUB');
        return this.event(initiator, t('capital.mutationLogMapper.planSet.main', { entityType, title }), {
          description: t('capital.mutationLogMapper.planSet.description', { planHours, planExpenses }),
          metadata: { plan_hours: String(planHours), plan_expenses: planExpenses, title, is_component: isComponent },
          reference_id: data.project_hash,
        });
      }

      case LogEventType.PROJECT_STARTED: {
        const { title, entityType, isComponent } = await this.getProjectInfo(data);
        return this.event(initiator, t('capital.mutationLogMapper.projectStarted.main', { entityType, title }), {
          metadata: { title, is_component: isComponent },
          reference_id: data.project_hash,
        });
      }

      case LogEventType.PROJECT_OPENED: {
        const { title, entityType, isComponent } = await this.getProjectInfo(data);
        return this.event(initiator, t('capital.mutationLogMapper.projectOpened.main', { entityType, title }), {
          metadata: { title, is_component: isComponent },
          reference_id: data.project_hash,
        });
      }

      case LogEventType.PROJECT_CLOSED: {
        const { title, entityType, isComponent } = await this.getProjectInfo(data);
        return this.event(initiator, t('capital.mutationLogMapper.projectClosed.main', { entityType, title }), {
          metadata: { title, is_component: isComponent },
          reference_id: data.project_hash,
        });
      }

      case LogEventType.PROJECT_STOPPED: {
        const { title, entityType, isComponent } = await this.getProjectInfo(data);
        return this.event(initiator, t('capital.mutationLogMapper.projectStopped.main', { entityType, title }), {
          metadata: { title, is_component: isComponent },
          reference_id: data.project_hash,
        });
      }

      case LogEventType.PROJECT_DELETED: {
        const { title, entityType, isComponent } = await this.getProjectInfo(data);
        return this.event(initiator, t('capital.mutationLogMapper.projectDeleted.main', { entityType, title }), {
          metadata: { title, is_component: isComponent },
          reference_id: data.project_hash,
        });
      }

      case LogEventType.CONTRIBUTOR_REGISTERED: {
        const contributor = data.username || data.contributor_hash || '';
        return this.event(initiator, t('capital.mutationLogMapper.contributorRegistered.main'), {
          description: this.person(contributor),
          metadata: { contributor },
          reference_id: data.contributor_hash,
        });
      }

      case LogEventType.CONTRIBUTOR_IMPORTED: {
        const contributor = data.username || '';
        const amount = this.formatMoney(data.contribution_amount || '0 RUB');
        return this.event(initiator, t('capital.mutationLogMapper.contributorImported.main'), {
          description: t('capital.mutationLogMapper.contributorImported.description', { person: this.person(contributor), amount }),
          metadata: { contributor, amount },
          reference_id: data.contributor_hash,
        });
      }

      case LogEventType.CONTRIBUTOR_JOINED: {
        const { title } = data.project_hash ? await this.getProjectInfo(data) : { title: '' };
        return this.event(initiator, title ? t('capital.mutationLogMapper.contributorJoined.withTitle', { title }) : t('capital.mutationLogMapper.contributorJoined.main'), {
          reference_id: data.project_hash,
        });
      }

      case LogEventType.CONTRIBUTOR_EDITED: {
        return this.event(initiator, t('capital.mutationLogMapper.contributorEdited.main'));
      }

      case LogEventType.STORY_CREATED:
      case LogEventType.STORY_UPDATED: {
        let storyInfo = {
          title: data.title || t('capital.mutationLogMapper.requirement.fallbackTitle'),
          issue_hash: null as string | null,
          project_hash: data.project_hash as string | null,
          issue_title: null as string | null,
          status: data.status as string | undefined,
        };
        if (data.story_hash) {
          try {
            const story = await this.storyRepository.findByStoryHash(data.story_hash);
            if (story) {
              storyInfo = {
                title: story.title || t('capital.mutationLogMapper.requirement.fallbackTitle'),
                issue_hash: story.issue_hash || null,
                project_hash: story.project_hash || null,
                issue_title: null,
                status: story.status,
              };
              if (story.issue_hash) {
                try {
                  const issue = await this.issueRepository.findByIssueHash(story.issue_hash);
                  if (issue?.title) storyInfo.issue_title = issue.title;
                } catch { /* ignore */ }
              }
            }
          } catch { /* ignore */ }
        }

        const isUpdate = eventType === LogEventType.STORY_UPDATED;
        const requirementType =
          storyInfo.status === 'completed' ? t('capital.mutationLogMapper.requirement.typeCompleted') : t('capital.mutationLogMapper.requirement.typeDefault');
        const verb = isUpdate ? t('capital.mutationLogMapper.requirement.verbUpdated') : t('capital.mutationLogMapper.requirement.verbCreated');
        let description: string | undefined;
        if (storyInfo.issue_hash && storyInfo.issue_title) {
          description = t('capital.mutationLogMapper.requirement.descriptionTask', { title: storyInfo.issue_title });
        } else if (storyInfo.project_hash) {
          let projectTitle = t('capital.mutationLogMapper.entityFallbackTitle.project');
          try {
            const project = await this.projectRepository.findByHash(storyInfo.project_hash);
            if (project?.title) projectTitle = project.title;
          } catch { /* ignore */ }
          description = t('capital.mutationLogMapper.requirement.descriptionProject', { title: projectTitle });
        }

        return this.event(initiator, `${verb} ${requirementType} «${storyInfo.title}»`, {
          description,
          metadata: {
            title: storyInfo.title,
            story_hash: data.story_hash,
            belongs_to_issue: !!storyInfo.issue_hash,
            issue_title: storyInfo.issue_title,
            status: storyInfo.status,
          },
          reference_id: storyInfo.issue_hash || storyInfo.project_hash || undefined,
        });
      }

      case LogEventType.STORY_DELETED: {
        return this.event(initiator, t('capital.mutationLogMapper.requirementDeleted.main'), {
          metadata: { story_hash: data.story_hash },
        });
      }

      case LogEventType.ISSUE_CREATED: {
        const title = data.title || t('capital.mutationLogMapper.issue.fallbackTitle');
        return this.event(initiator, t('capital.mutationLogMapper.issueCreated.main', { title }), {
          metadata: { title, issue_id: data.issue_id || data.id },
          reference_id: data.project_hash,
        });
      }

      case LogEventType.ISSUE_UPDATED: {
        let title = t('capital.mutationLogMapper.issue.fallbackTitle');
        if (data.issue_hash) {
          try {
            const issue = await this.issueRepository.findByIssueHash(data.issue_hash);
            if (issue?.title) title = issue.title;
          } catch { /* ignore */ }
        }
        if (data.title !== undefined) title = data.title || title;

        const changes: string[] = [];
        if (data.status !== undefined) {
          const statusLabels: Record<string, string> = {
            [IssueStatus.BACKLOG]: t('capital.mutationLogMapper.issue.status.backlog'),
            [IssueStatus.TODO]: t('capital.mutationLogMapper.issue.status.todo'),
            [IssueStatus.IN_PROGRESS]: t('capital.mutationLogMapper.issue.status.inProgress'),
            [IssueStatus.ON_REVIEW]: t('capital.mutationLogMapper.issue.status.onReview'),
            [IssueStatus.DONE]: t('capital.mutationLogMapper.issue.status.done'),
            [IssueStatus.CANCELED]: t('capital.mutationLogMapper.issue.status.canceled'),
          };
          changes.push(t('capital.mutationLogMapper.change.status', { status: statusLabels[data.status] || data.status }));
        }
        if (data.priority !== undefined) {
          const priorityLabels: Record<string, string> = {
            [IssuePriority.URGENT]: t('capital.mutationLogMapper.issue.priority.urgent'),
            [IssuePriority.HIGH]: t('capital.mutationLogMapper.issue.priority.high'),
            [IssuePriority.MEDIUM]: t('capital.mutationLogMapper.issue.priority.medium'),
            [IssuePriority.LOW]: t('capital.mutationLogMapper.issue.priority.low'),
          };
          changes.push(t('capital.mutationLogMapper.change.priority', { priority: priorityLabels[data.priority] || data.priority }));
        }
        if (data.estimate !== undefined) changes.push(t('capital.mutationLogMapper.change.estimate', { estimate: data.estimate }));
        if (data.creators !== undefined) {
          const creatorsArray = Array.isArray(data.creators) ? data.creators : [data.creators];
          if (creatorsArray.length === 0) changes.push(t('capital.mutationLogMapper.change.creatorsCleared'));
          else changes.push(t('capital.mutationLogMapper.change.creatorsSet', { creators: creatorsArray.map((c: string) => this.person(c)).join(', ') }));
        }
        if (data.submaster !== undefined) {
          changes.push(data.submaster ? t('capital.mutationLogMapper.change.submasterSet', { submaster: this.person(data.submaster) }) : t('capital.mutationLogMapper.change.submasterCleared'));
        }
        if (data.description !== undefined) changes.push(t('capital.mutationLogMapper.change.descriptionUpdated'));
        if (data.title !== undefined) changes.push(t('capital.mutationLogMapper.change.title', { title: data.title }));

        return this.event(initiator, t('capital.mutationLogMapper.issueUpdated.main', { title }), {
          description: changes.length ? changes.join('; ') : undefined,
          metadata: { title, issue_hash: data.issue_hash, changes },
          reference_id: data.project_hash,
        });
      }

      case LogEventType.ISSUE_DELETED: {
        return this.event(initiator, t('capital.mutationLogMapper.issueDeleted.main'), {
          metadata: { issue_id: data.issue_id || data.id },
          reference_id: data.project_hash,
        });
      }

      case LogEventType.CYCLE_CREATED: {
        const title = data.title || t('capital.mutationLogMapper.cycle.fallbackTitle');
        return this.event(initiator, t('capital.mutationLogMapper.cycleCreated.main', { title }), {
          metadata: { title, cycle_id: data.cycle_id || data.id },
          reference_id: data.project_hash,
        });
      }

      case LogEventType.COMMIT_RECEIVED: {
        const hours = data.commit_hours || data.creator_hours || 0;
        const { title } = data.project_hash ? await this.getProjectInfo(data) : { title: '' };
        return this.event(initiator, title ? t('capital.mutationLogMapper.commitSubmitted.withTitle', { title }) : t('capital.mutationLogMapper.commitSubmitted.main'), {
          description: t('capital.mutationLogMapper.commitSubmitted.description', { hours }),
          metadata: { amount: String(hours), symbol: t('capital.mutationLogMapper.commitSubmitted.unit') },
          reference_id: data.commit_hash,
        });
      }

      case LogEventType.INVESTMENT_RECEIVED: {
        const amount = this.formatMoney(data.amount || '0 RUB');
        const { title, entityType } = data.project_hash
          ? await this.getProjectInfo(data)
          : { title: '', entityType: t('capital.mutationLogMapper.entityType.project') };
        return this.event(
          initiator,
          title ? t('capital.mutationLogMapper.invested.main', { entityType, title }) : t('capital.mutationLogMapper.invested.fallback'),
          {
            description: amount,
            metadata: { amount },
            reference_id: data.invest_hash,
          }
        );
      }

      case LogEventType.PROGRAM_INVESTMENT_RECEIVED: {
        const amount = this.formatMoney(data.amount || '0 RUB');
        return this.event(initiator, t('capital.mutationLogMapper.investedProgram.main'), {
          description: amount,
          metadata: { amount },
          reference_id: data.invest_hash,
        });
      }

      case LogEventType.FUNDS_ALLOCATED: {
        const amount = this.formatMoney(data.amount || '0 RUB');
        const { title } = data.project_hash ? await this.getProjectInfo(data) : { title: '' };
        return this.event(
          initiator,
          title ? t('capital.mutationLogMapper.allocated.withTitle', { title }) : t('capital.mutationLogMapper.allocated.fallback'),
          {
            description: amount,
            metadata: { amount },
            reference_id: data.project_hash,
          }
        );
      }

      case LogEventType.FUNDS_DEALLOCATED: {
        const { title } = data.project_hash ? await this.getProjectInfo(data) : { title: '' };
        return this.event(
          initiator,
          title ? t('capital.mutationLogMapper.deallocated.withTitle', { title }) : t('capital.mutationLogMapper.deallocated.fallback'),
          { reference_id: data.project_hash }
        );
      }

      case LogEventType.PROJECT_PROPERTY_RECEIVED: {
        const { title, entityType, isComponent } = await this.getProjectInfo(data);
        const amount = this.formatMoney(data.property_amount || '0 RUB');
        return this.event(initiator, t('capital.mutationLogMapper.propertyContributed.main', { entityType, title }), {
          description: [amount, data.property_description].filter(Boolean).join(' · '),
          metadata: { amount, description: data.property_description, title, is_component: isComponent },
          reference_id: data.property_hash,
        });
      }

      case LogEventType.PROGRAM_PROPERTY_RECEIVED: {
        const amount = this.formatMoney(data.property_amount || '0 RUB');
        return this.event(initiator, t('capital.mutationLogMapper.propertyContributedProgram.main'), {
          description: [amount, data.property_description].filter(Boolean).join(' · '),
          metadata: { amount, description: data.property_description },
          reference_id: data.property_hash,
        });
      }

      case LogEventType.SEGMENT_REFRESHED: {
        const username = data.username || '';
        const { title, entityType } = data.project_hash
          ? await this.getProjectInfo(data)
          : { title: '', entityType: t('capital.mutationLogMapper.entityType.project') };
        return this.event(initiator, title ? t('capital.mutationLogMapper.segmentUpdated.withTitle', { entityType, title }) : t('capital.mutationLogMapper.segmentUpdated.fallback'), {
          description: this.person(username),
          metadata: { username },
          reference_id: data.project_hash,
        });
      }

      case LogEventType.DEBT_CREATED: {
        const amount = this.formatMoney(data.amount || '0 RUB');
        return this.event(initiator, t('capital.mutationLogMapper.debtCreated.main'), {
          description: amount,
          metadata: { amount },
          reference_id: data.debt_hash,
        });
      }

      case LogEventType.EXPENSE_CREATED: {
        const amount = this.formatMoney(data.amount || '0 RUB');
        return this.event(initiator, t('capital.mutationLogMapper.expenseCreated.main'), {
          description: [amount, data.description].filter(Boolean).join(' · '),
          metadata: { amount, description: data.description },
          reference_id: data.expense_hash,
        });
      }

      case LogEventType.EXPENSES_EXPANDED: {
        const amount = this.formatMoney(data.additional_expenses || '0 RUB');
        return this.event(initiator, t('capital.mutationLogMapper.expensesExpanded.main'), {
          description: amount,
          metadata: { amount },
          reference_id: data.project_hash,
        });
      }

      case LogEventType.PROJECT_FUNDED: {
        const { title, entityType, isComponent } = await this.getProjectInfo(data);
        const amount = this.formatMoney(data.amount || '0 RUB');
        return this.event(initiator, t('capital.mutationLogMapper.contributionsRegistered.main', { entityType, title }), {
          description: amount,
          metadata: { amount, memo: data.memo, title, is_component: isComponent },
          reference_id: data.project_hash,
        });
      }

      case LogEventType.PROJECT_REFRESHED: {
        const { title, entityType, isComponent } = await this.getProjectInfo(data);
        const username = data.username || '';
        return this.event(initiator, t('capital.mutationLogMapper.sharesUpdated.main', { entityType, title }), {
          description: this.person(username),
          metadata: { username, title, is_component: isComponent },
          reference_id: data.project_hash,
        });
      }

      case LogEventType.PROGRAM_FUNDED: {
        const amount = this.formatMoney(data.amount || '0 RUB');
        return this.event(initiator, t('capital.mutationLogMapper.contributionsRegisteredProgram.main'), {
          description: amount,
          metadata: { amount, memo: data.memo },
        });
      }

      case LogEventType.PROGRAM_REFRESHED: {
        const username = data.username || '';
        return this.event(initiator, t('capital.mutationLogMapper.sharesUpdatedProgram.main'), {
          description: this.person(username),
          metadata: { username },
        });
      }

      case LogEventType.VOTING_STARTED: {
        const { title } = data.project_hash
          ? await this.getProjectInfo(data)
          : { title: '' };
        return this.event(
          initiator,
          title ? t('capital.mutationLogMapper.votingStarted.withTitle', { title }) : t('capital.mutationLogMapper.votingStarted.fallback'),
          { reference_id: data.project_hash }
        );
      }

      case LogEventType.VOTE_SUBMITTED: {
        const voter = data.voter || initiator;
        const { title } = data.project_hash ? await this.getProjectInfo(data) : { title: '' };
        return this.event(voter, title ? t('capital.mutationLogMapper.voted.withTitle', { title }) : t('capital.mutationLogMapper.voted.fallback'), {
          metadata: { voter },
          reference_id: data.project_hash,
        });
      }

      case LogEventType.VOTING_COMPLETED: {
        const { title } = data.project_hash
          ? await this.getProjectInfo(data)
          : { title: '' };
        return this.event(
          initiator,
          title ? t('capital.mutationLogMapper.votingFinished.withTitle', { title }) : t('capital.mutationLogMapper.votingFinished.fallback'),
          { reference_id: data.project_hash }
        );
      }

      case LogEventType.VOTES_CALCULATED: {
        const username = data.username || '';
        return this.event(initiator, t('capital.mutationLogMapper.votesCalculated.main'), {
          description: this.person(username),
          metadata: { username },
          reference_id: data.project_hash,
        });
      }

      case LogEventType.RESULT_PUSHED: {
        const meta = data.statement?.meta || {};
        const amountRaw = data.contribution_amount || meta.total_amount || '0 RUB';
        const amount = this.formatMoney(amountRaw);
        const componentName = (meta.component_name || '').trim();
        const projectName = (meta.project_name || '').trim();
        let contextTitle = componentName || projectName;
        if (!contextTitle && data.project_hash) {
          const info = await this.getProjectInfo(data);
          contextTitle = info.title;
        }
        const parts = [amount];
        if (componentName && projectName) parts.push(`${componentName} · ${projectName}`);
        else if (contextTitle) parts.push(contextTitle);
        return this.event(
          initiator,
          contextTitle ? t('capital.mutationLogMapper.resultSubmitted.withTitle', { title: contextTitle }) : t('capital.mutationLogMapper.resultSubmitted.fallback'),
          {
            description: parts.join(' · '),
            metadata: { amount, component_name: componentName, project_name: projectName },
            reference_id: data.result_hash || meta.result_hash,
          }
        );
      }

      case LogEventType.SEGMENT_CONVERTED: {
        const wallet = this.formatMoney(data.wallet_amount || '0 RUB');
        const capital = this.formatMoney(data.capital_amount || '0 RUB');
        const { title } = data.project_hash ? await this.getProjectInfo(data) : { title: '' };
        return this.event(
          initiator,
          title ? t('capital.mutationLogMapper.segmentConverted.withTitle', { title }) : t('capital.mutationLogMapper.segmentConverted.fallback'),
          {
            description: t('capital.mutationLogMapper.segmentConverted.description', { wallet, capital }),
            metadata: { wallet_amount: wallet, capital_amount: capital },
            reference_id: data.result_hash,
          }
        );
      }

      case LogEventType.PROJECT_WITHDRAWAL: {
        const { title } = data.project_hash
          ? await this.getProjectInfo(data)
          : { title: '' };
        const blagorost = data.blagorost_wallet_amount
          ? this.formatMoney(data.blagorost_wallet_amount)
          : null;
        const main = data.main_wallet_amount ? this.formatMoney(data.main_wallet_amount) : null;
        const parts: string[] = [];
        if (blagorost && data.to_blagorost !== false) parts.push(t('capital.mutationLogMapper.withdrawal.toBlagorost', { amount: blagorost }));
        if (main && data.to_wallet) parts.push(t('capital.mutationLogMapper.withdrawal.toWallet', { amount: main }));
        return this.event(
          initiator,
          title ? t('capital.mutationLogMapper.withdrawal.withTitle', { title }) : t('capital.mutationLogMapper.withdrawal.fallback'),
          {
            description: parts.length ? parts.join(' · ') : undefined,
            metadata: { blagorost_wallet_amount: blagorost, main_wallet_amount: main },
            reference_id: data.project_hash,
          }
        );
      }

      case LogEventType.PROGRAM_WITHDRAWAL: {
        const amount = data.amount ? this.formatMoney(data.amount) : undefined;
        return this.event(initiator, t('capital.mutationLogMapper.withdrawalProgram.main'), {
          description: amount,
          metadata: amount ? { amount } : undefined,
        });
      }

      case LogEventType.RESULT_CONTRIBUTION_RECEIVED: {
        const amount = this.formatMoney(data.capital_amount || '0 RUB');
        return this.event(initiator, t('capital.mutationLogMapper.resultContributionReceived.main'), {
          description: amount,
          metadata: { amount },
          reference_id: data.result_hash,
        });
      }

      default:
        return this.event(initiator, t('capital.mutationLogMapper.unknownEvent.main', { eventType }));
    }
  }

  async mapMultipleToCapitalLogs(mutationLogs: InnerMutationLogEntry[]): Promise<IMappedCapitalLog[]> {
    this.nameCache.clear();
    const allNames = mutationLogs.flatMap((log) => this.collectUsernamesFromLog(log));
    await this.resolveNames(allNames);

    const mappedLogs = await Promise.all(mutationLogs.map((log) => this.mapToCapitalLog(log)));
    return mappedLogs.filter((log): log is IMappedCapitalLog => log !== null);
  }
}
