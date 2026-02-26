import { IssuePriority } from '../enums/issue-priority.enum';
import { IssueStatus } from '../enums/issue-status.enum';
import type { IIssueDatabaseData } from '../interfaces/issue-database.interface';
import { BaseDomainEntity } from '~/shared/sync/entities/base-domain.entity';

/**
 * Доменная сущность задачи
 *
 * Представляет задачу в системе управления задачами
 */
export class IssueDomainEntity extends BaseDomainEntity<IIssueDatabaseData> {
  // Специфичные поля для задачи
  public id: string; // Уникальный ID задачи в формате PREFIX-N (например, ABC-1)
  public issue_hash: string; // Хеш задачи для внешних ссылок
  public coopname: string; // Имя аккаунта кооператива
  public title: string; // Название задачи
  public description?: string; // Описание задачи
  public priority: IssuePriority; // Приоритет задачи
  public status: IssueStatus; // Статус задачи
  public estimate: number; // Оценка в story points или часах
  public sort_order: number; // Порядок сортировки
  public created_by: string; // Имя пользователя, создавшего задачу
  public submaster?: string; // Имя пользователя ответственного (contributor)
  public creators: string[]; // Массив имен пользователей создателей (contributors)
  public project_hash: string; // Хеш проекта
  public cycle_id?: string; // ID цикла
  public metadata: {
    labels: string[];
    attachments: string[];
  }; // Метаданные задачи

  /**
   * Конструктор для создания доменной сущности
   *
   * @param databaseData - данные из базы данных
   */
  constructor(databaseData: IIssueDatabaseData) {
    // Вызываем конструктор базового класса
    super(databaseData, IssueStatus.BACKLOG);

    // Устанавливаем специфичные поля задачи
    this.id = databaseData.id;
    this.issue_hash = databaseData.issue_hash.toLowerCase();
    this.coopname = databaseData.coopname;
    this.title = databaseData.title;
    this.description = databaseData.description;
    this.priority = databaseData.priority;
    this.status = databaseData.status; // Переопределяем статус с правильным типом
    this.estimate = databaseData.estimate;
    this.sort_order = databaseData.sort_order;
    this.created_by = databaseData.created_by;
    this.creators = databaseData.creators;
    this.submaster = databaseData.submaster;
    this.project_hash = databaseData.project_hash.toLowerCase();
    this.cycle_id = databaseData.cycle_id;
    this.metadata = databaseData.metadata;
  }

  /**
   * Добавление ответственного
   * Автоматически добавляет его в creators если его там нет
   */
  setSubmaster(submasterUsername: string): void {
    this.submaster = submasterUsername;
    if (!this.creators.includes(submasterUsername)) {
      this.creators.push(submasterUsername);
    }
  }

  /**
   * Добавление создателя
   */
  addCreator(creatorUsername: string): void {
    if (!this.creators.includes(creatorUsername)) {
      this.creators.push(creatorUsername);
    }
  }

  /**
   * Удаление создателя
   */
  removeCreator(creatorUsername: string): void {
    this.creators = this.creators.filter((username) => username !== creatorUsername);
    // Если удаляем ответственного, то очищаем submaster
    if (this.submaster === creatorUsername) {
      this.submaster = undefined;
    }
  }

  /**
   * Установка полного списка создателей (исполнителей)
   * Автоматически устанавливает первого из списка как ответственного (submaster)
   */
  setCreators(creators: string[]): void {
    this.creators = creators;
    if (creators.length > 0) {
      this.submaster = creators[0];
    } else {
      this.submaster = undefined;
    }
  }
}
