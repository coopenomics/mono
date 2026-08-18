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
    if (!username) return 'не указан';
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

    let title = data.title || (isComponent ? 'Компонент' : 'Проект');
    if (data.project_hash) {
      try {
        const project = await this.projectRepository.findByHash(data.project_hash);
        if (project?.title) title = project.title;
        // parent_hash из БД точнее для старых мутаций без parent_hash в args
        if (project && !data.parent_hash && project.parent_hash) {
          const ph = project.parent_hash;
          if (ph && ph !== '0000000000000000000000000000000000000000000000000000000000000000') {
            return { title, entityType: 'компонент', isComponent: true };
          }
        }
      } catch (error) {
        console.warn(`Failed to load project title for hash ${data.project_hash}:`, error);
      }
    }

    return { title, entityType: isComponent ? 'компонент' : 'проект', isComponent: !!isComponent };
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
        const title = data.title || 'без названия';
        return this.event(
          initiator,
          isComponent ? `Создал компонент «${title}»` : `Создал проект «${title}»`,
          {
            metadata: { title, parent_hash: data.parent_hash, is_component: !!isComponent },
            reference_id: data.project_hash,
          }
        );
      }

      case LogEventType.PROJECT_EDITED: {
        const { title, entityType, isComponent } = await this.getProjectInfo(data);
        const changes: string[] = [];
        if (data.title !== undefined) changes.push(`название → «${data.title}»`);
        if (data.description !== undefined) changes.push('обновил описание');
        return this.event(initiator, `Отредактировал ${entityType} «${title}»`, {
          description: changes.length ? changes.join('; ') : undefined,
          metadata: { title, is_component: isComponent, changes },
          reference_id: data.project_hash,
        });
      }

      case LogEventType.PROJECT_MASTER_ASSIGNED: {
        const { title, entityType, isComponent } = await this.getProjectInfo(data);
        const master = data.master || data.username || '';
        return this.event(initiator, `Назначил мастера на ${entityType} «${title}»`, {
          description: this.person(master),
          metadata: { master, title, is_component: isComponent },
          reference_id: data.project_hash,
        });
      }

      case LogEventType.AUTHOR_ADDED: {
        const author = data.author || data.username || '';
        return this.event(initiator, 'Добавил соавтора в проект', {
          description: this.person(author),
          metadata: { author },
          reference_id: data.project_hash,
        });
      }

      case LogEventType.PROJECT_PLAN_SET: {
        const { title, entityType, isComponent } = await this.getProjectInfo(data);
        const planHours = data.plan_creators_hours || 0;
        const planExpenses = this.formatMoney(data.plan_expenses || '0 RUB');
        return this.event(initiator, `Установил план ${entityType} «${title}»`, {
          description: `${planHours} ч, расходы ${planExpenses}`,
          metadata: { plan_hours: String(planHours), plan_expenses: planExpenses, title, is_component: isComponent },
          reference_id: data.project_hash,
        });
      }

      case LogEventType.PROJECT_STARTED: {
        const { title, entityType, isComponent } = await this.getProjectInfo(data);
        return this.event(initiator, `Запустил ${entityType} «${title}»`, {
          metadata: { title, is_component: isComponent },
          reference_id: data.project_hash,
        });
      }

      case LogEventType.PROJECT_OPENED: {
        const { title, entityType, isComponent } = await this.getProjectInfo(data);
        return this.event(initiator, `Открыл ${entityType} «${title}» для инвестиций`, {
          metadata: { title, is_component: isComponent },
          reference_id: data.project_hash,
        });
      }

      case LogEventType.PROJECT_CLOSED: {
        const { title, entityType, isComponent } = await this.getProjectInfo(data);
        return this.event(initiator, `Закрыл ${entityType} «${title}» для инвестиций`, {
          metadata: { title, is_component: isComponent },
          reference_id: data.project_hash,
        });
      }

      case LogEventType.PROJECT_STOPPED: {
        const { title, entityType, isComponent } = await this.getProjectInfo(data);
        return this.event(initiator, `Остановил ${entityType} «${title}»`, {
          metadata: { title, is_component: isComponent },
          reference_id: data.project_hash,
        });
      }

      case LogEventType.PROJECT_DELETED: {
        const { title, entityType, isComponent } = await this.getProjectInfo(data);
        return this.event(initiator, `Удалил ${entityType} «${title}»`, {
          metadata: { title, is_component: isComponent },
          reference_id: data.project_hash,
        });
      }

      case LogEventType.CONTRIBUTOR_REGISTERED: {
        const contributor = data.username || data.contributor_hash || '';
        return this.event(initiator, 'Зарегистрировал участника', {
          description: this.person(contributor),
          metadata: { contributor },
          reference_id: data.contributor_hash,
        });
      }

      case LogEventType.CONTRIBUTOR_IMPORTED: {
        const contributor = data.username || '';
        const amount = this.formatMoney(data.contribution_amount || '0 RUB');
        return this.event(initiator, 'Импортировал участника', {
          description: `${this.person(contributor)}, взнос ${amount}`,
          metadata: { contributor, amount },
          reference_id: data.contributor_hash,
        });
      }

      case LogEventType.CONTRIBUTOR_JOINED: {
        const { title } = data.project_hash ? await this.getProjectInfo(data) : { title: '' };
        return this.event(initiator, title ? `Присоединился к проекту «${title}»` : 'Присоединился к проекту', {
          reference_id: data.project_hash,
        });
      }

      case LogEventType.CONTRIBUTOR_EDITED: {
        return this.event(initiator, 'Отредактировал данные участника');
      }

      case LogEventType.STORY_CREATED:
      case LogEventType.STORY_UPDATED: {
        let storyInfo = {
          title: data.title || 'Требование',
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
                title: story.title || 'Требование',
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
          storyInfo.status === 'completed' ? 'выполненное требование' : 'требование';
        const verb = isUpdate ? 'Обновил' : 'Создал';
        let description: string | undefined;
        if (storyInfo.issue_hash && storyInfo.issue_title) {
          description = `к задаче «${storyInfo.issue_title}»`;
        } else if (storyInfo.project_hash) {
          let projectTitle = 'Проект';
          try {
            const project = await this.projectRepository.findByHash(storyInfo.project_hash);
            if (project?.title) projectTitle = project.title;
          } catch { /* ignore */ }
          description = `к «${projectTitle}»`;
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
        return this.event(initiator, 'Удалил требование', {
          metadata: { story_hash: data.story_hash },
        });
      }

      case LogEventType.ISSUE_CREATED: {
        const title = data.title || 'Задача';
        return this.event(initiator, `Создал задачу «${title}»`, {
          metadata: { title, issue_id: data.issue_id || data.id },
          reference_id: data.project_hash,
        });
      }

      case LogEventType.ISSUE_UPDATED: {
        let title = 'Задача';
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
            [IssueStatus.BACKLOG]: 'бэклог',
            [IssueStatus.TODO]: 'к выполнению',
            [IssueStatus.IN_PROGRESS]: 'в работе',
            [IssueStatus.ON_REVIEW]: 'на проверке',
            [IssueStatus.DONE]: 'выполнена',
            [IssueStatus.CANCELED]: 'отменена',
          };
          changes.push(`статус → «${statusLabels[data.status] || data.status}»`);
        }
        if (data.priority !== undefined) {
          const priorityLabels: Record<string, string> = {
            [IssuePriority.URGENT]: 'срочный',
            [IssuePriority.HIGH]: 'высокий',
            [IssuePriority.MEDIUM]: 'средний',
            [IssuePriority.LOW]: 'низкий',
          };
          changes.push(`приоритет → «${priorityLabels[data.priority] || data.priority}»`);
        }
        if (data.estimate !== undefined) changes.push(`оценка → ${data.estimate} ч`);
        if (data.creators !== undefined) {
          const creatorsArray = Array.isArray(data.creators) ? data.creators : [data.creators];
          if (creatorsArray.length === 0) changes.push('снял ответственных');
          else changes.push(`ответственные: ${creatorsArray.map((c: string) => this.person(c)).join(', ')}`);
        }
        if (data.submaster !== undefined) {
          changes.push(data.submaster ? `соисполнитель: ${this.person(data.submaster)}` : 'снял соисполнителя');
        }
        if (data.description !== undefined) changes.push('обновил описание');
        if (data.title !== undefined) changes.push(`название → «${data.title}»`);

        return this.event(initiator, `Обновил задачу «${title}»`, {
          description: changes.length ? changes.join('; ') : undefined,
          metadata: { title, issue_hash: data.issue_hash, changes },
          reference_id: data.project_hash,
        });
      }

      case LogEventType.ISSUE_DELETED: {
        return this.event(initiator, 'Удалил задачу', {
          metadata: { issue_id: data.issue_id || data.id },
          reference_id: data.project_hash,
        });
      }

      case LogEventType.CYCLE_CREATED: {
        const title = data.title || 'Цикл';
        return this.event(initiator, `Создал цикл «${title}»`, {
          metadata: { title, cycle_id: data.cycle_id || data.id },
          reference_id: data.project_hash,
        });
      }

      case LogEventType.COMMIT_RECEIVED: {
        const hours = data.commit_hours || data.creator_hours || 0;
        const { title } = data.project_hash ? await this.getProjectInfo(data) : { title: '' };
        return this.event(initiator, title ? `Отправил коммит в «${title}»` : 'Отправил коммит', {
          description: `${hours} ч`,
          metadata: { amount: String(hours), symbol: 'часов' },
          reference_id: data.commit_hash,
        });
      }

      case LogEventType.INVESTMENT_RECEIVED: {
        const amount = this.formatMoney(data.amount || '0 RUB');
        const { title, entityType } = data.project_hash
          ? await this.getProjectInfo(data)
          : { title: '', entityType: 'проект' };
        return this.event(
          initiator,
          title ? `Инвестировал в ${entityType} «${title}»` : 'Инвестировал в проект',
          {
            description: amount,
            metadata: { amount },
            reference_id: data.invest_hash,
          }
        );
      }

      case LogEventType.PROGRAM_INVESTMENT_RECEIVED: {
        const amount = this.formatMoney(data.amount || '0 RUB');
        return this.event(initiator, 'Инвестировал в программу Благорост', {
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
          title ? `Аллоцировал средства в проект «${title}»` : 'Аллоцировал средства из программы в проект',
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
          title ? `Вернул средства из проекта «${title}» в программу` : 'Деаллоцировал средства из проекта в программу',
          { reference_id: data.project_hash }
        );
      }

      case LogEventType.PROJECT_PROPERTY_RECEIVED: {
        const { title, entityType, isComponent } = await this.getProjectInfo(data);
        const amount = this.formatMoney(data.property_amount || '0 RUB');
        return this.event(initiator, `Внёс имущество в ${entityType} «${title}»`, {
          description: [amount, data.property_description].filter(Boolean).join(' · '),
          metadata: { amount, description: data.property_description, title, is_component: isComponent },
          reference_id: data.property_hash,
        });
      }

      case LogEventType.PROGRAM_PROPERTY_RECEIVED: {
        const amount = this.formatMoney(data.property_amount || '0 RUB');
        return this.event(initiator, 'Внёс имущество в программу Благорост', {
          description: [amount, data.property_description].filter(Boolean).join(' · '),
          metadata: { amount, description: data.property_description },
          reference_id: data.property_hash,
        });
      }

      case LogEventType.SEGMENT_REFRESHED: {
        const username = data.username || '';
        const { title, entityType } = data.project_hash
          ? await this.getProjectInfo(data)
          : { title: '', entityType: 'проект' };
        return this.event(initiator, title ? `Обновил сегмент в ${entityType} «${title}»` : 'Обновил сегмент участника', {
          description: this.person(username),
          metadata: { username },
          reference_id: data.project_hash,
        });
      }

      case LogEventType.DEBT_CREATED: {
        const amount = this.formatMoney(data.amount || '0 RUB');
        return this.event(initiator, 'Выдан займ под залог коммита', {
          description: amount,
          metadata: { amount },
          reference_id: data.debt_hash,
        });
      }

      case LogEventType.EXPENSE_CREATED: {
        const amount = this.formatMoney(data.amount || '0 RUB');
        return this.event(initiator, 'Создал расход', {
          description: [amount, data.description].filter(Boolean).join(' · '),
          metadata: { amount, description: data.description },
          reference_id: data.expense_hash,
        });
      }

      case LogEventType.EXPENSES_EXPANDED: {
        const amount = this.formatMoney(data.additional_expenses || '0 RUB');
        return this.event(initiator, 'Расширил план расходов', {
          description: amount,
          metadata: { amount },
          reference_id: data.project_hash,
        });
      }

      case LogEventType.PROJECT_FUNDED: {
        const { title, entityType, isComponent } = await this.getProjectInfo(data);
        const amount = this.formatMoney(data.amount || '0 RUB');
        return this.event(initiator, `Зарегистрированы взносы в ${entityType} «${title}»`, {
          description: amount,
          metadata: { amount, memo: data.memo, title, is_component: isComponent },
          reference_id: data.project_hash,
        });
      }

      case LogEventType.PROJECT_REFRESHED: {
        const { title, entityType, isComponent } = await this.getProjectInfo(data);
        const username = data.username || '';
        return this.event(initiator, `Обновлены доли в ${entityType} «${title}»`, {
          description: this.person(username),
          metadata: { username, title, is_component: isComponent },
          reference_id: data.project_hash,
        });
      }

      case LogEventType.PROGRAM_FUNDED: {
        const amount = this.formatMoney(data.amount || '0 RUB');
        return this.event(initiator, 'Зарегистрированы взносы в программу Благорост', {
          description: amount,
          metadata: { amount, memo: data.memo },
        });
      }

      case LogEventType.PROGRAM_REFRESHED: {
        const username = data.username || '';
        return this.event(initiator, 'Обновлены доли в программе Благорост', {
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
          title ? `Начал голосование по «${title}»` : 'Начал голосование по проекту',
          { reference_id: data.project_hash }
        );
      }

      case LogEventType.VOTE_SUBMITTED: {
        const voter = data.voter || initiator;
        const { title } = data.project_hash ? await this.getProjectInfo(data) : { title: '' };
        return this.event(voter, title ? `Проголосовал по «${title}»` : 'Проголосовал', {
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
          title ? `Завершил голосование по «${title}»` : 'Завершил голосование по проекту',
          { reference_id: data.project_hash }
        );
      }

      case LogEventType.VOTES_CALCULATED: {
        const username = data.username || '';
        return this.event(initiator, 'Подсчитаны голоса', {
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
          contextTitle ? `Внёс результат по «${contextTitle}»` : 'Внёс результат интеллектуальной деятельности',
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
          title ? `Получил долю в ОАП «${title}»` : 'Конвертировал сегмент результата',
          {
            description: `Кошелёк ${wallet} · Благорост ${capital}`,
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
        if (blagorost && data.to_blagorost !== false) parts.push(`в Благорост ${blagorost}`);
        if (main && data.to_wallet) parts.push(`на кошелёк ${main}`);
        return this.event(
          initiator,
          title ? `Возврат из «${title}»` : 'Возврат из проекта',
          {
            description: parts.length ? parts.join(' · ') : undefined,
            metadata: { blagorost_wallet_amount: blagorost, main_wallet_amount: main },
            reference_id: data.project_hash,
          }
        );
      }

      case LogEventType.PROGRAM_WITHDRAWAL: {
        const amount = data.amount ? this.formatMoney(data.amount) : undefined;
        return this.event(initiator, 'Возврат из программы Благорост', {
          description: amount,
          metadata: amount ? { amount } : undefined,
        });
      }

      case LogEventType.RESULT_CONTRIBUTION_RECEIVED: {
        const amount = this.formatMoney(data.capital_amount || '0 RUB');
        return this.event(initiator, 'Совершил взнос результатом', {
          description: amount,
          metadata: { amount },
          reference_id: data.result_hash,
        });
      }

      default:
        return this.event(initiator, `Событие ${eventType}`);
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
