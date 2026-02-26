import type { IStateDatabaseData } from '../interfaces/state-database.interface';
import type { IStateBlockchainData } from '../interfaces/state-blockchain.interface';
import type { IBlockchainSynchronizable } from '~/shared/interfaces/blockchain-sync.interface';
import { BaseDomainEntity } from '~/shared/sync/entities/base-domain.entity';
/**
 * Доменная сущность состояния кооператива
 *
 * Полностью агрегирует данные из двух источников:
 * - База данных: внутренний ID, ссылка на блокчейн
 * - Блокчейн: все данные состояния из таблицы state
 */
export class StateDomainEntity
  extends BaseDomainEntity<IStateDatabaseData>
  implements IBlockchainSynchronizable, Partial<IStateBlockchainData>
{
  // Статические поля ключей для поиска и синхронизации
  private static primary_key = 'coopname';
  private static sync_key = 'coopname';

  // Специфичные поля для state

  // Поля из блокчейна (state.hpp)
  public coopname: IStateBlockchainData['coopname'];
  public global_available_invest_pool?: IStateBlockchainData['global_available_invest_pool'];
  public program_membership_funded?: IStateBlockchainData['program_membership_funded'];
  public program_membership_available?: IStateBlockchainData['program_membership_available'];
  public program_membership_distributed?: IStateBlockchainData['program_membership_distributed'];
  public program_membership_cumulative_reward_per_share?: IStateBlockchainData['program_membership_cumulative_reward_per_share'];
  public config?: IStateBlockchainData['config'];

  /**
   * Конструктор для сборки композитной сущности
   *
   * @param databaseData - данные из базы данных
   * @param blockchainData - данные из блокчейна
   */
  constructor(databaseData: IStateDatabaseData, blockchainData?: IStateBlockchainData) {
    // Вызываем конструктор базового класса с данными
    super(databaseData);

    // Специфичные поля для state
    this.coopname = databaseData.coopname;

    // Данные из блокчейна
    if (blockchainData) {
      this.coopname = blockchainData.coopname;
      this.global_available_invest_pool = blockchainData.global_available_invest_pool;
      this.program_membership_funded = blockchainData.program_membership_funded;
      this.program_membership_available = blockchainData.program_membership_available;
      this.program_membership_distributed = blockchainData.program_membership_distributed;
      this.program_membership_cumulative_reward_per_share = blockchainData.program_membership_cumulative_reward_per_share;
      this.config = blockchainData.config;
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
    return StateDomainEntity.primary_key;
  }

  /**
   * Получение ключа для синхронизации сущности в блокчейне и базе данных (статический метод)
   */
  public static getSyncKey(): string {
    return StateDomainEntity.sync_key;
  }

  /**
   * Получение ключа для поиска сущности в блокчейне
   */
  getPrimaryKey(): string {
    return StateDomainEntity.primary_key;
  }

  /**
   * Получение ключа для синхронизации сущности в блокчейне и базе данных
   */
  getSyncKey(): string {
    return StateDomainEntity.sync_key;
  }

  /**
   * Обновление данных из блокчейна
   * Обновляет текущий экземпляр
   */
  updateFromBlockchain(blockchainData: IStateBlockchainData, blockNum: number, present = true): void {
    if (this.coopname !== blockchainData.coopname) throw new Error('Coopname mismatch');

    // Обновляем базовые поля через метод базового класса
    this.block_num = blockNum;
    this.present = present;

    // Обновляем все поля из блокчейна
    Object.assign(this, blockchainData);
    this.block_num = blockNum;
    this.present = present;
  }
}
