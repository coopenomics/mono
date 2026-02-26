import { SegmentStatus } from '../enums/segment-status.enum';
import type { ISegmentDatabaseData } from '../interfaces/segment-database.interface';
import type { ISegmentBlockchainData } from '../interfaces/segment-blockchain.interface';
import type { IBlockchainSynchronizable } from '~/shared/interfaces/blockchain-sync.interface';
import { BaseDomainEntity } from '~/shared/sync/entities/base-domain.entity';
import type { ResultDomainEntity } from './result.entity';

/**
 * Доменная сущность сегмента участника в проекте
 *
 * Полностью агрегирует данные из двух источников:
 * - База данных: внутренний ID, ссылка на блокчейн
 * - Блокчейн: все данные сегмента из таблицы segments
 *
 * Сегмент содержит информацию о вкладах и роли участника в проекте капитализации
 */
export class SegmentDomainEntity
  extends BaseDomainEntity<ISegmentDatabaseData>
  implements IBlockchainSynchronizable, Partial<ISegmentBlockchainData>
{
  // Статические поля ключей для поиска и синхронизации
  private static primary_key = 'id';
  private static sync_key = 'id'; // Ключ для синхронизации по проекту

  // Специфичные поля для segment
  public id?: number; // ID в блокчейне
  public status: SegmentStatus = SegmentStatus.GENERATION;
  public is_completed?: boolean; // Завершена ли конвертация сегмента

  // Дополнительные поля из связанных сущностей
  public display_name?: string; // Отображаемое имя из участника
  public result?: ResultDomainEntity; // Связанный результат

  // Поля из блокчейна (segments.hpp)
  public project_hash?: ISegmentBlockchainData['project_hash'];
  public coopname?: ISegmentBlockchainData['coopname'];
  public username?: ISegmentBlockchainData['username'];

  // Роли участника в проекте
  public is_author?: ISegmentBlockchainData['is_author'];
  public is_creator?: ISegmentBlockchainData['is_creator'];
  public is_coordinator?: ISegmentBlockchainData['is_coordinator'];
  public is_investor?: ISegmentBlockchainData['is_investor'];
  public is_propertor?: ISegmentBlockchainData['is_propertor'];
  public is_contributor?: ISegmentBlockchainData['is_contributor'];
  public has_vote?: ISegmentBlockchainData['has_vote'];

  // Вклады инвестора
  public investor_amount?: ISegmentBlockchainData['investor_amount'];
  public investor_base?: ISegmentBlockchainData['investor_base'];

  // Вклады создателя
  public creator_base?: ISegmentBlockchainData['creator_base'];
  public creator_bonus?: ISegmentBlockchainData['creator_bonus'];

  // Вклады автора
  public author_base?: ISegmentBlockchainData['author_base'];
  public author_bonus?: ISegmentBlockchainData['author_bonus'];

  // Вклады координатора
  public coordinator_investments?: ISegmentBlockchainData['coordinator_investments'];
  public coordinator_base?: ISegmentBlockchainData['coordinator_base'];

  // Вклады участника
  public contributor_bonus?: ISegmentBlockchainData['contributor_bonus'];

  // Имущественные взносы
  public property_base?: ISegmentBlockchainData['property_base'];

  // CRPS поля для масштабируемого распределения наград
  public last_author_base_reward_per_share?: ISegmentBlockchainData['last_author_base_reward_per_share'];
  public last_author_bonus_reward_per_share?: ISegmentBlockchainData['last_author_bonus_reward_per_share'];
  public last_contributor_reward_per_share?: ISegmentBlockchainData['last_contributor_reward_per_share'];

  // Доли в программе и проекте
  public capital_contributor_shares?: ISegmentBlockchainData['capital_contributor_shares'];

  // Последняя известная сумма инвестиций в проекте для расчета provisional_amount
  public last_known_invest_pool?: ISegmentBlockchainData['last_known_invest_pool'];

  // Последняя известная сумма базового пула создателей для расчета использования инвестиций
  public last_known_creators_base_pool?: ISegmentBlockchainData['last_known_creators_base_pool'];

  // Последняя известная сумма инвестиций координаторов для отслеживания изменений
  public last_known_coordinators_investment_pool?: ISegmentBlockchainData['last_known_coordinators_investment_pool'];

  // Финансовые данные для ссуд
  public provisional_amount?: ISegmentBlockchainData['provisional_amount'];
  public debt_amount?: ISegmentBlockchainData['debt_amount'];
  public debt_settled?: ISegmentBlockchainData['debt_settled'];

  // Пулы равных премий авторов и прямых премий создателей
  public equal_author_bonus?: ISegmentBlockchainData['equal_author_bonus'];
  public direct_creator_bonus?: ISegmentBlockchainData['direct_creator_bonus'];

  // Результаты голосования по методу Водянова
  public voting_bonus?: ISegmentBlockchainData['voting_bonus'];
  public is_votes_calculated?: ISegmentBlockchainData['is_votes_calculated'];

  // Общая стоимость сегмента (рассчитывается автоматически)
  public total_segment_base_cost?: ISegmentBlockchainData['total_segment_base_cost'];
  public total_segment_bonus_cost?: ISegmentBlockchainData['total_segment_bonus_cost'];
  public total_segment_cost?: ISegmentBlockchainData['total_segment_cost'];

  // Интеллектуальная собственность и доли
  public intellectual_cost?: ISegmentBlockchainData['intellectual_cost'];
  public share_percent?: ISegmentBlockchainData['share_percent'];

  // Доступная сумма для конвертации в программу
  public available_for_program?: ISegmentBlockchainData['available_for_program'];
  // Доступная сумма для конвертации в кошелек
  public available_for_wallet?: ISegmentBlockchainData['available_for_wallet'];
  /**
   * Конструктор для сборки композитной сущности
   *
   * @param databaseData - данные из базы данных
   * @param blockchainData - данные из блокчейна
   * @param additionalData - дополнительные данные из связанных сущностей
   */
  constructor(
    databaseData: ISegmentDatabaseData,
    blockchainData?: ISegmentBlockchainData,
    additionalData?: { display_name?: string; result?: ResultDomainEntity }
  ) {
    // Вызываем конструктор базового класса с данными
    super(databaseData, SegmentStatus.UNDEFINED);

    // Устанавливаем статус из databaseData по умолчанию
    this.status = databaseData.status ? this.mapStatusToDomain(databaseData.status) : SegmentStatus.UNDEFINED;

    // Специфичные поля для segment
    // Для сегментов статус будет установлен из blockchainData или по умолчанию
    // Для сегментов project_hash будет установлен из blockchainData

    // Данные из блокчейна
    if (blockchainData) {
      // Проверяем корректность данных
      if (blockchainData.id && this.id && Number(blockchainData.id) !== this.id) {
        throw new Error('Segment ID mismatch');
      }

      this.id = Number(blockchainData.id);
      this.project_hash = blockchainData.project_hash.toLowerCase();
      this.coopname = blockchainData.coopname;
      this.username = blockchainData.username;

      // Роли участника
      this.is_author = blockchainData.is_author;
      this.is_creator = blockchainData.is_creator;
      this.is_coordinator = blockchainData.is_coordinator;
      this.is_investor = blockchainData.is_investor;
      this.is_propertor = blockchainData.is_propertor;
      this.is_contributor = blockchainData.is_contributor;
      this.has_vote = blockchainData.has_vote;

      // Финансовые данные
      this.investor_amount = blockchainData.investor_amount;
      this.investor_base = blockchainData.investor_base;
      this.creator_base = blockchainData.creator_base;
      this.creator_bonus = blockchainData.creator_bonus;
      this.author_base = blockchainData.author_base;
      this.author_bonus = blockchainData.author_bonus;
      this.coordinator_investments = blockchainData.coordinator_investments;
      this.coordinator_base = blockchainData.coordinator_base;
      this.contributor_bonus = blockchainData.contributor_bonus;
      this.property_base = blockchainData.property_base;

      // CRPS поля
      this.last_author_base_reward_per_share = blockchainData.last_author_base_reward_per_share;
      this.last_author_bonus_reward_per_share = blockchainData.last_author_bonus_reward_per_share;
      this.last_contributor_reward_per_share = blockchainData.last_contributor_reward_per_share;

      // Доли и пулы
      this.capital_contributor_shares = blockchainData.capital_contributor_shares;
      this.last_known_invest_pool = blockchainData.last_known_invest_pool;
      this.last_known_creators_base_pool = blockchainData.last_known_creators_base_pool;
      this.last_known_coordinators_investment_pool = blockchainData.last_known_coordinators_investment_pool;

      // Финансовые данные для ссуд
      this.provisional_amount = blockchainData.provisional_amount;
      this.debt_amount = blockchainData.debt_amount;
      this.debt_settled = blockchainData.debt_settled;

      // Премии и бонусы
      this.equal_author_bonus = blockchainData.equal_author_bonus;
      this.direct_creator_bonus = blockchainData.direct_creator_bonus;
      this.voting_bonus = blockchainData.voting_bonus;
      this.is_votes_calculated = blockchainData.is_votes_calculated;

      // Общая стоимость
      this.total_segment_base_cost = blockchainData.total_segment_base_cost;
      this.total_segment_bonus_cost = blockchainData.total_segment_bonus_cost;
      this.total_segment_cost = blockchainData.total_segment_cost;

      // Интеллектуальная стоимость и доля участника в результате интеллектуальной деятельности
      this.intellectual_cost = blockchainData.intellectual_cost;
      this.share_percent = blockchainData.share_percent;

      // Доступная сумма для конвертации в программу
      this.available_for_program = blockchainData.available_for_program;
      // Доступная сумма для конвертации в кошелек
      this.available_for_wallet = blockchainData.available_for_wallet;
      // Синхронизация статуса с блокчейн данными
      this.status = this.mapStatusToDomain(blockchainData.status);
    }

    // Устанавливаем дополнительные поля
    if (additionalData) {
      this.display_name = additionalData.display_name;
      this.result = additionalData.result;
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
    return SegmentDomainEntity.primary_key;
  }

  /**
   * Получение ключа для синхронизации сущности в блокчейне и базе данных (статический метод)
   */
  public static getSyncKey(): string {
    return SegmentDomainEntity.sync_key;
  }

  /**
   * Получение ключа для поиска сущности в блокчейне
   */
  getPrimaryKey(): string {
    return SegmentDomainEntity.primary_key;
  }

  /**
   * Получение ключа для синхронизации сущности в блокчейне и базе данных
   */
  getSyncKey(): string {
    return SegmentDomainEntity.sync_key;
  }

  /**
   * Получение составного ключа синхронизации (project_hash + username)
   * Для сегментов используется составной ключ для уникальной идентификации
   */
  getCompositeSyncKey(): string {
    if (!this.project_hash || !this.username) {
      return '';
    }
    return `${this.project_hash}_${this.username}`;
  }

  /**
   * Обновление данных из блокчейна
   * Обновляет текущий экземпляр
   */
  updateFromBlockchain(blockchainData: ISegmentBlockchainData, blockNum: number, present = true): void {
    this.block_num = blockNum;
    this.present = present;

    if (!present) {
      // Сегмент удален из блокчейна - помечаем как завершенный
      this.status = SegmentStatus.FINALIZED;
      this.is_completed = true;
    } else {
      // Сегмент существует в блокчейне - обновляем все поля
      Object.assign(this, blockchainData);

      // Нормализация полей
      if (this.project_hash) this.project_hash = this.project_hash.toLowerCase();

      // Синхронизация статуса
      this.status = this.mapStatusToDomain(blockchainData.status);
    }
  }

  /**
   * Маппинг статуса из блокчейна в доменный статус
   * Синхронизировано с константами из segments.hpp
   */
  private mapStatusToDomain(blockchainStatus?: string): SegmentStatus {
    switch (blockchainStatus) {
      case 'generation':
        return SegmentStatus.GENERATION;
      case 'ready':
        return SegmentStatus.READY;
      case 'statement':
        return SegmentStatus.STATEMENT;
      case 'approved':
        return SegmentStatus.APPROVED;
      case 'authorized':
        return SegmentStatus.AUTHORIZED;
      case 'act1':
        return SegmentStatus.ACT1;
      case 'contributed':
        return SegmentStatus.CONTRIBUTED;
      case 'finalized':
        return SegmentStatus.FINALIZED;
      case 'skipped':
        return SegmentStatus.SKIPPED;
      default:
        return SegmentStatus.UNDEFINED;
    }
  }
}
