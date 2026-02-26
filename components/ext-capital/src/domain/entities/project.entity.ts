import { ProjectStatus } from '../enums/project-status.enum';
import type { IProjectDomainInterfaceDatabaseData } from '../interfaces/project-database.interface';
import type { IProjectDomainInterfaceBlockchainData } from '../interfaces/project-blockchain.interface';
import type { IBlockchainSynchronizable } from '~/shared/interfaces/blockchain-sync.interface';
import { BaseDomainEntity } from '~/shared/sync/entities/base-domain.entity';
import { IssueIdGenerationService } from '../services/issue-id-generation.service';
/**
 * Доменная сущность проекта
 *
 * Полностью агрегирует данные из двух источников:
 * - База данных: внутренний ID, ссылка на блокчейн
 * - Блокчейн: все данные проекта из таблицы projects
 */
export class ProjectDomainEntity
  extends BaseDomainEntity<IProjectDomainInterfaceDatabaseData>
  implements IBlockchainSynchronizable, Partial<IProjectDomainInterfaceBlockchainData>
{
  // Статические поля ключей для поиска и синхронизации
  private static primary_key = 'id';
  private static sync_key = 'project_hash';

  // Поля из базы данных
  public id?: number; // ID в блокчейне

  // Доменные поля (расширения)
  public status: ProjectStatus;
  public prefix: string; // Префикс проекта из первых 3 символов project_hash в верхнем регистре
  public issue_counter: number; // Счетчик для генерации последовательных ID задач
  public voting_deadline: Date | null; // Денормализованное поле для быстрого поиска проектов с голосованиями

  // Поля из блокчейна (projects.hpp)
  public project_hash: IProjectDomainInterfaceBlockchainData['project_hash'];

  public coopname?: IProjectDomainInterfaceBlockchainData['coopname'];
  public parent_hash?: IProjectDomainInterfaceBlockchainData['parent_hash'];
  public blockchain_status?: IProjectDomainInterfaceBlockchainData['status']; // Статус из блокчейна
  public is_opened?: IProjectDomainInterfaceBlockchainData['is_opened'];
  public is_planed?: IProjectDomainInterfaceBlockchainData['is_planed'];
  public is_authorized?: IProjectDomainInterfaceBlockchainData['is_authorized'];
  public master?: IProjectDomainInterfaceBlockchainData['master'];
  public title?: IProjectDomainInterfaceBlockchainData['title'];
  public description?: IProjectDomainInterfaceBlockchainData['description'];
  public invite?: IProjectDomainInterfaceBlockchainData['invite'];
  public data?: IProjectDomainInterfaceBlockchainData['data'];
  public meta?: IProjectDomainInterfaceBlockchainData['meta'];
  public authorization?: IProjectDomainInterfaceBlockchainData['authorization'];
  public counts?: IProjectDomainInterfaceBlockchainData['counts'];
  public plan?: IProjectDomainInterfaceBlockchainData['plan'];
  public fact?: IProjectDomainInterfaceBlockchainData['fact'];
  public crps?: IProjectDomainInterfaceBlockchainData['crps'];
  public voting?: IProjectDomainInterfaceBlockchainData['voting'];
  public created_at?: IProjectDomainInterfaceBlockchainData['created_at'];

  /**
   * Конструктор для сборки композитной сущности
   *
   * @param databaseData - данные из базы данных
   * @param blockchainData - данные из блокчейна
   */
  constructor(databaseData: IProjectDomainInterfaceDatabaseData, blockchainData?: IProjectDomainInterfaceBlockchainData) {
    // Вызываем конструктор базового класса с данными
    super(databaseData, ProjectStatus.PENDING);

    // Специфичные поля для project
    this.status = this.mapStatusToDomain(databaseData.status);
    this.project_hash = databaseData.project_hash.toLowerCase();
    this.prefix = databaseData.prefix;
    this.issue_counter = databaseData.issue_counter;
    this.voting_deadline = databaseData.voting_deadline;

    // Инициализируем поля для генерации ID задач, если они не заданы
    this.initializeIssueIdFields();

    // Данные из блокчейна
    if (blockchainData) {
      if (this.project_hash != blockchainData.project_hash.toLowerCase()) throw new Error('Project hash mismatch');

      this.id = Number(blockchainData.id);
      this.coopname = blockchainData.coopname;
      this.project_hash = blockchainData.project_hash.toLowerCase();
      this.parent_hash = blockchainData.parent_hash.toLowerCase();
      this.blockchain_status = blockchainData.status;
      this.is_opened = blockchainData.is_opened;
      this.is_planed = blockchainData.is_planed;
      this.master = blockchainData.master;
      this.title = blockchainData.title;
      this.description = blockchainData.description;
      this.invite = blockchainData.invite;
      this.data = blockchainData.data;
      this.meta = blockchainData.meta;
      this.authorization = blockchainData.authorization;
      this.counts = blockchainData.counts;
      this.plan = blockchainData.plan;
      this.fact = blockchainData.fact;
      this.crps = blockchainData.crps;
      this.voting = blockchainData.voting;
      this.created_at = blockchainData.created_at;

      // Синхронизация статуса с блокчейн данными
      this.status = this.mapStatusToDomain(blockchainData.status);
    }
  }

  /**
   * Получение номера блока последнего обновления
   */
  getBlockNum(): number | undefined {
    return this.block_num;
  }

  /**
   * Получение ключа для поиска сущности в блокчейне (статический метод)
   */
  public static getPrimaryKey(): string {
    return ProjectDomainEntity.primary_key;
  }

  /**
   * Получение ключа для синхронизации сущности в блокчейне и базе данных (статический метод)
   */
  public static getSyncKey(): string {
    return ProjectDomainEntity.sync_key;
  }

  /**
   * Получение ключа для поиска сущности в блокчейне
   */
  getPrimaryKey(): string {
    return ProjectDomainEntity.primary_key;
  }

  /**
   * Получение ключа для синхронизации сущности в блокчейне и базе данных
   */
  getSyncKey(): string {
    return ProjectDomainEntity.sync_key;
  }

  /**
   * Обновление данных из блокчейна
   * Обновляет текущий экземпляр
   */
  updateFromBlockchain(blockchainData: IProjectDomainInterfaceBlockchainData, blockNum: number, present = true): void {
    // Обновляем базовые поля через метод базового класса
    this.block_num = blockNum;
    this.present = present;

    // Обновляем специфичные поля из блокчейна
    Object.assign(this, blockchainData);
    this.blockchain_status = blockchainData.status;
    this.status = this.mapStatusToDomain(blockchainData.status);

    // Нормализация hash полей
    if (this.project_hash) this.project_hash = this.project_hash.toLowerCase();
    if (this.parent_hash) this.parent_hash = this.parent_hash.toLowerCase();

    // Синхронизируем денормализованное поле voting_deadline
    if (blockchainData.voting?.voting_deadline) {
      const deadline = new Date(blockchainData.voting.voting_deadline);
      // Если дедлайн равен 1970-01-01T00:00:00.000, значит голосования нет
      this.voting_deadline = deadline.getTime() === 0 ? null : deadline;
    } else {
      this.voting_deadline = null;
    }
  }

  /**
   * Инициализирует поля для генерации ID задач
   * Вызывается при первом создании проекта
   */
  initializeIssueIdFields(): void {
    if (!this.prefix) {
      this.prefix = IssueIdGenerationService.generateProjectPrefix(this.project_hash);
    }
    if (this.issue_counter === undefined || this.issue_counter === null) {
      this.issue_counter = 0;
    }
  }

  /**
   * Маппинг статуса из блокчейна в доменный статус
   * Синхронизировано с константами из projects.hpp
   */
  private mapStatusToDomain(blockchainStatus?: string): ProjectStatus {
    switch (blockchainStatus) {
      case 'pending':
        return ProjectStatus.PENDING;
      case 'active':
        return ProjectStatus.ACTIVE;
      case 'voting':
        return ProjectStatus.VOTING;
      case 'result':
        return ProjectStatus.RESULT;
      case 'finalized':
        return ProjectStatus.FINALIZED;
      case 'cancelled':
        return ProjectStatus.CANCELLED;
      default:
        // По умолчанию считаем статус неопределенным
        return ProjectStatus.UNDEFINED;
    }
  }

  isComponent(): boolean {
    return !!this.parent_hash && this.parent_hash !== '0000000000000000000000000000000000000000000000000000000000000000';
  }
}
