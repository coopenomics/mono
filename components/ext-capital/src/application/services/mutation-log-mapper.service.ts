import { Injectable } from '@nestjs/common';
import type { MutationLogDomainEntity } from '~/domain/mutation-log/entities/mutation-log-domain.entity';
import { LogEventType } from '../../domain/enums/log-event-type.enum';
import { IssuePriority } from '../../domain/enums/issue-priority.enum';
import { IssueStatus } from '../../domain/enums/issue-status.enum';
import { ISSUE_REPOSITORY, IssueRepository } from '../../domain/repositories/issue.repository';
import { PROJECT_REPOSITORY, ProjectRepository } from '../../domain/repositories/project.repository';
import { STORY_REPOSITORY, StoryRepository } from '../../domain/repositories/story.repository';
import { Inject } from '@nestjs/common';

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
  project_hash?: string; // Хеш проекта контекста (может быть пустым для глобальных событий)
  entity_type: LogEntityType; // Тип сущности к которой относится событие
  entity_id?: string; // ID сущности (project_hash, issue_hash, story_hash и т.д.)
  event_type: LogEventType;
  initiator: string;
  reference_id?: string; // Устаревшее поле, оставлено для совместимости
  metadata?: Record<string, any>;
  message: string;
  created_at: Date;
}

/**
 * Сервис для преобразования логов мутаций в логи событий capital
 * Каждая мутация преобразуется в читаемое текстовое сообщение
 */
@Injectable()
export class MutationLogMapperService {
  constructor(
    @Inject(ISSUE_REPOSITORY)
    private readonly issueRepository: IssueRepository,
    @Inject(PROJECT_REPOSITORY)
    private readonly projectRepository: ProjectRepository,
    @Inject(STORY_REPOSITORY)
    private readonly storyRepository: StoryRepository
  ) {}

  /**
   * Вспомогательная функция для получения типа и названия проекта/компонента
   */
  private async getProjectInfo(data: any): Promise<{ title: string; entityType: string; isComponent: boolean }> {
    const isComponent =
      data.parent_hash && data.parent_hash !== '0000000000000000000000000000000000000000000000000000000000000000';

    let title = data.title || (isComponent ? 'Компонент' : 'Проект');
    if (data.project_hash) {
      try {
        const project = await this.projectRepository.findByHash(data.project_hash);
        if (project && project.title) {
          title = project.title;
        }
      } catch (error) {
        console.warn(`Failed to load project title for hash ${data.project_hash}:`, error);
      }
    }

    const entityType = isComponent ? 'компонент' : 'проект';

    return { title, entityType, isComponent };
  }

  /**
   * Маппинг имен мутаций на типы событий
   */
  private readonly mutationToEventType: Record<string, LogEventType> = {
    // Проектное управление
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

    // Управление участниками
    capitalRegisterContributor: LogEventType.CONTRIBUTOR_REGISTERED,
    capitalImportContributor: LogEventType.CONTRIBUTOR_IMPORTED,
    capitalMakeClearance: LogEventType.CONTRIBUTOR_JOINED,
    capitalEditContributor: LogEventType.CONTRIBUTOR_EDITED,

    // Инвестиции и имущество
    capitalCreateProjectInvest: LogEventType.INVESTMENT_RECEIVED,
    capitalCreateProgramInvest: LogEventType.PROGRAM_INVESTMENT_RECEIVED,
    capitalAllocate: LogEventType.FUNDS_ALLOCATED,
    capitalCreateProjectProperty: LogEventType.PROJECT_PROPERTY_RECEIVED,
    capitalCreateProgramProperty: LogEventType.PROGRAM_PROPERTY_RECEIVED,

    // Генерация и активная работа
    capitalCreateCommit: LogEventType.COMMIT_RECEIVED,
    capitalRefreshSegment: LogEventType.SEGMENT_REFRESHED,
    capitalCreateDebt: LogEventType.DEBT_CREATED,
    capitalCreateExpense: LogEventType.EXPENSE_CREATED,
    capitalExpandExpenses: LogEventType.EXPENSES_EXPANDED,
    capitalFundProject: LogEventType.PROJECT_FUNDED,
    capitalRefreshProject: LogEventType.PROJECT_REFRESHED,
    capitalFundProgram: LogEventType.PROGRAM_FUNDED,
    capitalRefreshProgram: LogEventType.PROGRAM_REFRESHED,

    // Голосование
    capitalStartVoting: LogEventType.VOTING_STARTED,
    capitalSubmitVote: LogEventType.VOTE_SUBMITTED,
    capitalCompleteVoting: LogEventType.VOTING_COMPLETED,
    capitalCalculateVotes: LogEventType.VOTES_CALCULATED,

    // Результаты и конвертация
    capitalPushResult: LogEventType.RESULT_PUSHED,
    capitalConvertSegment: LogEventType.SEGMENT_CONVERTED,
    capitalGenerateGenerationToMainWalletConvertStatement: LogEventType.PROJECT_WITHDRAWAL,
    capitalGenerateCapitalizationToMainWalletConvertStatement: LogEventType.PROGRAM_WITHDRAWAL,

    // Генерация - Stories, Issues, Cycles
    capitalCreateStory: LogEventType.STORY_CREATED,
    capitalUpdateStory: LogEventType.STORY_UPDATED,
    capitalDeleteStory: LogEventType.STORY_DELETED,
    capitalCreateIssue: LogEventType.ISSUE_CREATED,
    capitalUpdateIssue: LogEventType.ISSUE_UPDATED,
    capitalDeleteIssue: LogEventType.ISSUE_DELETED,
    capitalCreateCycle: LogEventType.CYCLE_CREATED,
  };

  /**
   * Список имен мутаций, которые относятся к capital расширению
   */
  getCapitalMutationNames(): string[] {
    return Object.keys(this.mutationToEventType);
  }

  /**
   * Получить список имен мутаций для логов
   */
  getMutationNamesForLogging(): string[] {
    return Object.keys(this.mutationToEventType);
  }

  /**
   * Проверка, относится ли мутация к capital расширению
   */
  isCapitalMutation(mutationName: string): boolean {
    return mutationName in this.mutationToEventType;
  }

  /**
   * Определение типа сущности и ее ID на основе типа события
   */
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
  async mapToCapitalLog(mutationLog: MutationLogDomainEntity): Promise<IMappedCapitalLog | null> {
    const eventType = this.mutationToEventType[mutationLog.mutation_name];

    if (!eventType) {
      return null;
    }

    const args = mutationLog.arguments;
    const data = args.data || args.input || args;

    // Извлекаем общие поля
    const coopname = data.coopname || mutationLog.coopname || '';
    const initiator = mutationLog.username;

    // Определяем тип сущности и ее ID
    const { entity_type, entity_id, project_hash } = await this.determineEntityInfo(eventType, data);

    // Генерируем сообщение и метаданные в зависимости от типа события
    const messageData = await this.generateMessageAndMetadata(eventType, initiator, data);

    if (!messageData) {
      return null;
    }

    const { message, metadata, reference_id } = messageData;

    return {
      _id: mutationLog._id,
      coopname,
      project_hash,
      entity_type,
      entity_id,
      event_type: eventType,
      initiator,
      reference_id,
      metadata,
      message,
      created_at: mutationLog.created_at,
    };
  }

  /**
   * Генерация сообщения и метаданных на основе типа события
   */
  private async generateMessageAndMetadata(
    eventType: LogEventType,
    initiator: string,
    data: any
  ): Promise<{ message: string; metadata?: Record<string, any>; reference_id?: string }> {
    switch (eventType) {
      case LogEventType.PROJECT_CREATED: {
        const isComponent =
          data.parent_hash && data.parent_hash !== '0000000000000000000000000000000000000000000000000000000000000000';
        const title = data.title || 'без названия';

        if (isComponent) {
          return {
            message: `Пайщик #${initiator} создал компонент "${title}"`,
            metadata: {
              title,
              parent_hash: data.parent_hash,
            },
            reference_id: data.project_hash,
          };
        } else {
          return {
            message: `Пайщик #${initiator} создал проект "${title}"`,
            metadata: {
              title,
            },
            reference_id: data.project_hash,
          };
        }
      }

      case LogEventType.PROJECT_EDITED: {
        const { title, entityType, isComponent } = await this.getProjectInfo(data);

        return {
          message: `Пайщик #${initiator} отредактировал ${entityType} "${title}"`,
          metadata: {
            title,
            is_component: isComponent,
          },
          reference_id: data.project_hash,
        };
      }

      case LogEventType.PROJECT_MASTER_ASSIGNED: {
        const { title, entityType, isComponent } = await this.getProjectInfo(data);
        const master = data.master || data.username || 'не указан';

        return {
          message: `Пайщик #${initiator} назначил мастера #${master} на ${entityType} "${title}"`,
          metadata: {
            master,
            title,
            is_component: isComponent,
          },
          reference_id: data.project_hash,
        };
      }

      case LogEventType.AUTHOR_ADDED: {
        const author = data.author || data.username || 'не указан';
        return {
          message: `Пайщик #${initiator} добавил соавтора #${author} в проект`,
          metadata: {
            author,
          },
          reference_id: data.project_hash,
        };
      }

      case LogEventType.PROJECT_PLAN_SET: {
        const { title, entityType, isComponent } = await this.getProjectInfo(data);
        const planHours = data.plan_creators_hours || 0;
        const planExpenses = data.plan_expenses || '0 RUB';
        const [expenseValue, expenseSymbol] = planExpenses.split(' ');

        return {
          message: `Пайщик #${initiator} установил план ${entityType} "${title}": ${planHours} часов, ${expenseValue} ${
            expenseSymbol || 'RUB'
          }`,
          metadata: {
            plan_hours: planHours.toString(),
            plan_expenses: expenseValue,
            expenses_symbol: expenseSymbol || 'RUB',
            title,
            is_component: isComponent,
          },
          reference_id: data.project_hash,
        };
      }

      case LogEventType.PROJECT_STARTED: {
        const { title, entityType, isComponent } = await this.getProjectInfo(data);

        return {
          message: `Пайщик #${initiator} запустил ${entityType} "${title}"`,
          metadata: {
            title,
            is_component: isComponent,
          },
          reference_id: data.project_hash,
        };
      }

      case LogEventType.PROJECT_OPENED: {
        const { title, entityType, isComponent } = await this.getProjectInfo(data);

        return {
          message: `Пайщик #${initiator} открыл ${entityType} "${title}" для инвестиций`,
          metadata: {
            title,
            is_component: isComponent,
          },
          reference_id: data.project_hash,
        };
      }

      case LogEventType.PROJECT_CLOSED: {
        const { title, entityType, isComponent } = await this.getProjectInfo(data);

        return {
          message: `Пайщик #${initiator} закрыл ${entityType} "${title}" для инвестиций`,
          metadata: {
            title,
            is_component: isComponent,
          },
          reference_id: data.project_hash,
        };
      }

      case LogEventType.PROJECT_STOPPED: {
        const { title, entityType, isComponent } = await this.getProjectInfo(data);

        return {
          message: `Пайщик #${initiator} остановил ${entityType} "${title}"`,
          metadata: {
            title,
            is_component: isComponent,
          },
          reference_id: data.project_hash,
        };
      }

      case LogEventType.PROJECT_DELETED: {
        const { title, entityType, isComponent } = await this.getProjectInfo(data);

        return {
          message: `Пайщик #${initiator} удалил ${entityType} "${title}"`,
          metadata: {
            title,
            is_component: isComponent,
          },
          reference_id: data.project_hash,
        };
      }

      case LogEventType.CONTRIBUTOR_REGISTERED: {
        const contributor = data.username || data.contributor_hash || 'не указан';
        return {
          message: `Пайщик #${initiator} зарегистрировал участника #${contributor}`,
          metadata: {
            contributor,
          },
          reference_id: data.contributor_hash,
        };
      }

      case LogEventType.CONTRIBUTOR_IMPORTED: {
        const contributor = data.username || 'не указан';
        const amount = data.contribution_amount || '0 RUB';
        const [amountValue, symbol] = amount.split(' ');
        return {
          message: `Пайщик #${initiator} импортировал участника #${contributor} с взносом ${amountValue} ${symbol || 'RUB'}`,
          metadata: {
            contributor,
            amount: amountValue,
            symbol: symbol || 'RUB',
          },
          reference_id: data.contributor_hash,
        };
      }

      case LogEventType.CONTRIBUTOR_JOINED: {
        return {
          message: `Пайщик #${initiator} присоединился к проекту`,
          reference_id: data.project_hash,
        };
      }

      case LogEventType.CONTRIBUTOR_EDITED: {
        return {
          message: `Пайщик #${initiator} отредактировал данные участника`,
        };
      }

      case LogEventType.STORY_CREATED: {
        // Получаем полную информацию о созданном требовании
        let storyInfo = {
          title: 'Требование',
          issue_hash: null as string | null,
          project_hash: data.project_hash,
          issue_title: null as string | null,
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
              };

              // Если требование принадлежит задаче - получаем название задачи
              if (story.issue_hash) {
                try {
                  const issue = await this.issueRepository.findByIssueHash(story.issue_hash);
                  if (issue && issue.title) {
                    storyInfo.issue_title = issue.title;
                  }
                } catch (error) {
                  console.warn(`Failed to load issue title for hash ${story.issue_hash}:`, error);
                }
              }
            }
          } catch (error) {
            console.warn(`Failed to load story info for hash ${data.story_hash}:`, error);
          }
        }

        // Формируем сообщение в зависимости от принадлежности
        let message: string;
        if (storyInfo.issue_hash && storyInfo.issue_title) {
          message = `Пайщик #${initiator} создал требование "${storyInfo.title}" к задаче "${storyInfo.issue_title}"`;
        } else {
          // Получаем информацию о проекте
          let projectTitle = 'Проект';
          if (storyInfo.project_hash) {
            try {
              const project = await this.projectRepository.findByHash(storyInfo.project_hash);
              if (project && project.title) {
                projectTitle = project.title;
              }
            } catch (error) {
              console.warn(`Failed to load project title for hash ${storyInfo.project_hash}:`, error);
            }
          }
          const entityType =
            storyInfo.project_hash &&
            storyInfo.project_hash !== '0000000000000000000000000000000000000000000000000000000000000000'
              ? 'компоненту'
              : 'проекту';
          message = `Пайщик #${initiator} создал требование "${storyInfo.title}" к ${entityType} "${projectTitle}"`;
        }

        const reference_id = storyInfo.issue_hash || storyInfo.project_hash;
        return {
          message,
          metadata: {
            title: storyInfo.title,
            story_hash: data.story_hash,
            belongs_to_issue: !!storyInfo.issue_hash,
            issue_title: storyInfo.issue_title,
          },
          reference_id,
        };
      }

      case LogEventType.STORY_UPDATED: {
        // Получаем полную информацию об обновленном требовании
        let storyInfo = {
          title: 'Требование',
          issue_hash: null as string | null,
          project_hash: data.project_hash,
          issue_title: null as string | null,
          status: data.status,
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
                status: story.status, // Используем статус из базы, а не из аргументов мутации
              };

              // Если требование принадлежит задаче - получаем название задачи
              if (story.issue_hash) {
                try {
                  const issue = await this.issueRepository.findByIssueHash(story.issue_hash);
                  if (issue && issue.title) {
                    storyInfo.issue_title = issue.title;
                  }
                } catch (error) {
                  console.warn(`Failed to load issue title for hash ${story.issue_hash}:`, error);
                }
              }
            }
          } catch (error) {
            console.warn(`Failed to load story info for hash ${data.story_hash}:`, error);
          }
        }

        // Определяем тип требования (выполненное или обычное)
        const requirementType = storyInfo.status === 'completed' ? 'выполненное требование' : 'требование';

        // Формируем сообщение в зависимости от принадлежности
        let message: string;
        if (storyInfo.issue_hash && storyInfo.issue_title) {
          message = `Пайщик #${initiator} обновил ${requirementType} "${storyInfo.title}" к задаче "${storyInfo.issue_title}"`;
        } else {
          // Получаем информацию о проекте
          let projectTitle = 'Проект';
          if (storyInfo.project_hash) {
            try {
              const project = await this.projectRepository.findByHash(storyInfo.project_hash);
              if (project && project.title) {
                projectTitle = project.title;
              }
            } catch (error) {
              console.warn(`Failed to load project title for hash ${storyInfo.project_hash}:`, error);
            }
          }
          const entityType =
            storyInfo.project_hash &&
            storyInfo.project_hash !== '0000000000000000000000000000000000000000000000000000000000000000'
              ? 'компоненту'
              : 'проекту';
          message = `Пайщик #${initiator} обновил ${requirementType} "${storyInfo.title}" к ${entityType} "${projectTitle}"`;
        }

        const reference_id = storyInfo.issue_hash || storyInfo.project_hash;
        return {
          message,
          metadata: {
            title: storyInfo.title,
            story_hash: data.story_hash,
            belongs_to_issue: !!storyInfo.issue_hash,
            issue_title: storyInfo.issue_title,
            status: storyInfo.status,
          },
          reference_id,
        };
      }

      case LogEventType.STORY_DELETED: {
        return {
          message: `Пайщик #${initiator} удалил требование`,
          metadata: {
            story_hash: data.story_hash,
          },
        };
      }

      case LogEventType.ISSUE_CREATED: {
        const title = data.title || 'Задача';
        return {
          message: `Пайщик #${initiator} создал задачу "${title}"`,
          metadata: {
            title,
            issue_id: data.issue_id || data.id,
          },
          reference_id: data.project_hash,
        };
      }

      case LogEventType.ISSUE_UPDATED: {
        // Получаем реальное название задачи из базы данных
        let title = 'Задача';
        if (data.issue_hash) {
          try {
            const issue = await this.issueRepository.findByIssueHash(data.issue_hash);
            if (issue && issue.title) {
              title = issue.title;
            }
          } catch (error) {
            // В случае ошибки используем дефолтное название
            console.warn(`Failed to load issue title for hash ${data.issue_hash}:`, error);
          }
        }

        // Анализируем аргументы для детализации изменений
        const changes: string[] = [];

        if (data.status !== undefined) {
          const statusLabels = {
            [IssueStatus.BACKLOG]: 'бэклог',
            [IssueStatus.TODO]: 'к выполнению',
            [IssueStatus.IN_PROGRESS]: 'в работе',
            [IssueStatus.ON_REVIEW]: 'на проверке',
            [IssueStatus.DONE]: 'выполнена',
            [IssueStatus.CANCELED]: 'отменена',
          };
          const statusText = statusLabels[data.status] || data.status;
          changes.push(`изменил статус на "${statusText}"`);
        }

        if (data.priority !== undefined) {
          const priorityLabels = {
            [IssuePriority.URGENT]: 'срочный',
            [IssuePriority.HIGH]: 'высокий',
            [IssuePriority.MEDIUM]: 'средний',
            [IssuePriority.LOW]: 'низкий',
          };
          const priorityText = priorityLabels[data.priority] || data.priority;
          changes.push(`изменил приоритет на "${priorityText}"`);
        }

        if (data.estimate !== undefined) {
          changes.push(`изменил оценку на ${data.estimate} ч`);
        }

        if (data.creators !== undefined) {
          const creatorsArray = Array.isArray(data.creators) ? data.creators : [data.creators];
          if (creatorsArray.length === 0) {
            changes.push('снял ответственных');
          } else {
            const creatorsText = creatorsArray.join(', #');
            const word = creatorsArray.length === 1 ? 'ответственного' : 'ответственных';
            changes.push(`назначил ${word} #${creatorsText}`);
          }
        }

        if (data.submaster !== undefined) {
          changes.push(`назначил соисполнителя #${data.submaster}`);
        }

        if (data.description !== undefined) {
          changes.push('обновил описание');
        }

        if (data.title !== undefined) {
          changes.push(`изменил название на "${data.title}"`);
        }

        // Если изменения не распознаны, используем общее сообщение
        const message =
          changes.length > 0
            ? `Пайщик #${initiator} ${changes.join(', ')} в задаче "${title}"`
            : `Пайщик #${initiator} обновил задачу "${title}"`;

        return {
          message,
          metadata: {
            title,
            issue_hash: data.issue_hash,
            changes: changes.length > 0 ? changes : undefined,
            raw_data: data, // сохраняем сырые данные для отладки
          },
          reference_id: data.project_hash,
        };
      }

      case LogEventType.ISSUE_DELETED: {
        return {
          message: `Пайщик #${initiator} удалил задачу`,
          metadata: {
            issue_id: data.issue_id || data.id,
          },
          reference_id: data.project_hash,
        };
      }

      case LogEventType.CYCLE_CREATED: {
        const title = data.title || 'Цикл';
        return {
          message: `Пайщик #${initiator} создал цикл "${title}"`,
          metadata: {
            title,
            cycle_id: data.cycle_id || data.id,
          },
          reference_id: data.project_hash,
        };
      }

      case LogEventType.COMMIT_RECEIVED: {
        const hours = data.commit_hours || data.creator_hours || 0;
        return {
          message: `Пайщик #${initiator} отправил коммит на сумму ${hours} часов`,
          metadata: {
            amount: hours.toString(),
            symbol: 'часов',
          },
          reference_id: data.commit_hash,
        };
      }

      case LogEventType.INVESTMENT_RECEIVED: {
        const amount = data.amount || '0 RUB';
        const [amountValue, symbol] = amount.split(' ');
        return {
          message: `Пайщик #${initiator} инвестировал ${amountValue} ${symbol || 'RUB'}`,
          metadata: {
            amount: amountValue,
            symbol: symbol || 'RUB',
          },
          reference_id: data.invest_hash,
        };
      }

      case LogEventType.PROGRAM_INVESTMENT_RECEIVED: {
        const amount = data.amount || '0 RUB';
        const [amountValue, symbol] = amount.split(' ');
        return {
          message: `Пайщик #${initiator} инвестировал ${amountValue} ${symbol || 'RUB'} в программу`,
          metadata: {
            amount: amountValue,
            symbol: symbol || 'RUB',
          },
          reference_id: data.invest_hash,
        };
      }

      case LogEventType.FUNDS_ALLOCATED: {
        const amount = data.amount || '0 RUB';
        const [amountValue, symbol] = amount.split(' ');
        return {
          message: `Пайщик #${initiator} аллоцировал ${amountValue} ${symbol || 'RUB'} из программы в проект`,
          metadata: {
            amount: amountValue,
            symbol: symbol || 'RUB',
          },
          reference_id: data.project_hash,
        };
      }

      case LogEventType.FUNDS_DEALLOCATED: {
        return {
          message: `Пайщик #${initiator} деаллоцировал средства из проекта в программу`,
          reference_id: data.project_hash,
        };
      }

      case LogEventType.PROJECT_PROPERTY_RECEIVED: {
        const { title, entityType, isComponent } = await this.getProjectInfo(data);
        const amount = data.property_amount || '0 RUB';
        const [amountValue, symbol] = amount.split(' ');

        return {
          message: `Пайщик #${initiator} внес имущество в ${entityType} "${title}" на сумму ${amountValue} ${
            symbol || 'RUB'
          }`,
          metadata: {
            amount: amountValue,
            symbol: symbol || 'RUB',
            description: data.property_description,
            title,
            is_component: isComponent,
          },
          reference_id: data.property_hash,
        };
      }

      case LogEventType.PROGRAM_PROPERTY_RECEIVED: {
        const amount = data.property_amount || '0 RUB';
        const [amountValue, symbol] = amount.split(' ');
        return {
          message: `Пайщик #${initiator} внес имущество в программу на сумму ${amountValue} ${symbol || 'RUB'}`,
          metadata: {
            amount: amountValue,
            symbol: symbol || 'RUB',
            description: data.property_description,
          },
          reference_id: data.property_hash,
        };
      }

      case LogEventType.SEGMENT_REFRESHED: {
        const username = data.username || 'не указан';
        return {
          message: `Обновлен сегмент участника #${username}`,
          metadata: {
            username,
          },
          reference_id: data.project_hash,
        };
      }

      case LogEventType.DEBT_CREATED: {
        const amount = data.amount || '0 RUB';
        const [amountValue, symbol] = amount.split(' ');
        return {
          message: `Пайщику #${initiator} выдан займ под залог коммита на сумму ${amountValue} ${symbol || 'RUB'}`,
          metadata: {
            amount: amountValue,
            symbol: symbol || 'RUB',
          },
          reference_id: data.debt_hash,
        };
      }

      case LogEventType.EXPENSE_CREATED: {
        const amount = data.amount || '0 RUB';
        const [amountValue, symbol] = amount.split(' ');
        return {
          message: `Пайщик #${initiator} создал расход ${amountValue} ${symbol || 'RUB'}`,
          metadata: {
            amount: amountValue,
            symbol: symbol || 'RUB',
            description: data.description,
          },
          reference_id: data.expense_hash,
        };
      }

      case LogEventType.EXPENSES_EXPANDED: {
        const amount = data.additional_expenses || '0 RUB';
        const [amountValue, symbol] = amount.split(' ');
        return {
          message: `Пайщик #${initiator} расширил план расходов на ${amountValue} ${symbol || 'RUB'}`,
          metadata: {
            amount: amountValue,
            symbol: symbol || 'RUB',
          },
          reference_id: data.project_hash,
        };
      }

      case LogEventType.PROJECT_FUNDED: {
        const { title, entityType, isComponent } = await this.getProjectInfo(data);
        const amount = data.amount || '0 RUB';
        const [amountValue, symbol] = amount.split(' ');

        return {
          message: `Зарегистрированы членские взносы в ${entityType} "${title}": ${amountValue} ${symbol || 'RUB'}`,
          metadata: {
            amount: amountValue,
            symbol: symbol || 'RUB',
            memo: data.memo,
            title,
            is_component: isComponent,
          },
          reference_id: data.project_hash,
        };
      }

      case LogEventType.PROJECT_REFRESHED: {
        const { title, entityType, isComponent } = await this.getProjectInfo(data);
        const username = data.username || 'не указан';

        return {
          message: `Обновлены доли участника #${username} в ${entityType} "${title}"`,
          metadata: {
            username,
            title,
            is_component: isComponent,
          },
          reference_id: data.project_hash,
        };
      }

      case LogEventType.PROGRAM_FUNDED: {
        const amount = data.amount || '0 RUB';
        const [amountValue, symbol] = amount.split(' ');
        return {
          message: `Зарегистрированы членские взносы в программу: ${amountValue} ${symbol || 'RUB'}`,
          metadata: {
            amount: amountValue,
            symbol: symbol || 'RUB',
            memo: data.memo,
          },
        };
      }

      case LogEventType.PROGRAM_REFRESHED: {
        const username = data.username || 'не указан';
        return {
          message: `Обновлены доли участника #${username} в программе`,
          metadata: {
            username,
          },
        };
      }

      case LogEventType.VOTING_STARTED: {
        return {
          message: `Пайщик #${initiator} начал голосование по проекту`,
          reference_id: data.project_hash,
        };
      }

      case LogEventType.VOTE_SUBMITTED: {
        const voter = data.voter || initiator;
        return {
          message: `Пайщик #${voter} проголосовал`,
          metadata: {
            voter,
          },
          reference_id: data.project_hash,
        };
      }

      case LogEventType.VOTING_COMPLETED: {
        return {
          message: `Пайщик #${initiator} завершил голосование по проекту`,
          reference_id: data.project_hash,
        };
      }

      case LogEventType.VOTES_CALCULATED: {
        const username = data.username || 'не указан';
        return {
          message: `Подсчитаны голоса для участника #${username}`,
          metadata: {
            username,
          },
          reference_id: data.project_hash,
        };
      }

      case LogEventType.RESULT_PUSHED: {
        const contributionAmount = data.contribution_amount || '0 RUB';
        const [amountValue, symbol] = contributionAmount.split(' ');
        return {
          message: `Пайщик #${initiator} внес результат на сумму ${amountValue} ${symbol || 'RUB'}`,
          metadata: {
            amount: amountValue,
            symbol: symbol || 'RUB',
          },
          reference_id: data.result_hash,
        };
      }

      case LogEventType.SEGMENT_CONVERTED: {
        const walletAmount = data.wallet_amount || '0 RUB';
        const capitalAmount = data.capital_amount || '0 RUB';
        const projectAmount = data.project_amount || '0 RUB';
        const [walletValue] = walletAmount.split(' ');
        const [capitalValue] = capitalAmount.split(' ');
        const [projectValue] = projectAmount.split(' ');
        return {
          message: `Пайщик #${initiator} конвертировал сегмент: ${walletValue} в кошелек, ${capitalValue} в капитализацию, ${projectValue} в проект`,
          metadata: {
            wallet_amount: walletValue,
            capital_amount: capitalValue,
            project_amount: projectValue,
          },
          reference_id: data.convert_hash,
        };
      }

      case LogEventType.PROJECT_WITHDRAWAL: {
        return {
          message: `Пайщик #${initiator} выполнил возврат из проекта`,
          reference_id: data.project_hash,
        };
      }

      case LogEventType.PROGRAM_WITHDRAWAL: {
        return {
          message: `Пайщик #${initiator} выполнил возврат из программы капитализации`,
        };
      }

      case LogEventType.RESULT_CONTRIBUTION_RECEIVED: {
        const capitalAmount = data.capital_amount || '0 RUB';
        const [amountValue, symbol] = capitalAmount.split(' ');
        return {
          message: `Пайщик #${initiator} совершил взнос результатом на сумму ${amountValue} ${symbol || 'RUB'}`,
          metadata: {
            amount: amountValue,
            symbol: symbol || 'RUB',
          },
          reference_id: data.convert_hash || data.result_hash,
        };
      }

      default:
        return {
          message: `Событие ${eventType} инициировано пользователем ${initiator}`,
        };
    }
  }

  /**
   * Массовое преобразование логов мутаций
   */
  async mapMultipleToCapitalLogs(mutationLogs: MutationLogDomainEntity[]): Promise<IMappedCapitalLog[]> {
    const mappedLogs = await Promise.all(mutationLogs.map((log) => this.mapToCapitalLog(log)));
    return mappedLogs.filter((log): log is IMappedCapitalLog => log !== null);
  }
}
