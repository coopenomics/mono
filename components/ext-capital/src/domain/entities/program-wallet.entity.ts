import type { IProgramWalletDatabaseData } from '../interfaces/program-wallet-database.interface';
import type { IProgramWalletBlockchainData } from '../interfaces/program-wallet-blockchain.interface';
import type { IBlockchainSynchronizable } from '~/shared/interfaces/blockchain-sync.interface';
import { randomUUID } from 'crypto';
import { BaseDomainEntity } from '~/shared/sync/entities/base-domain.entity';

/**
 * Доменная сущность программного кошелька
 *
 * Полностью агрегирует данные из двух источников:
 * - База данных: внутренний ID, ссылка на блокчейн
 * - Блокчейн: все данные программного кошелька из таблицы capwallets
 */
export class ProgramWalletDomainEntity
  extends BaseDomainEntity<IProgramWalletDatabaseData>
  implements IBlockchainSynchronizable, Partial<IProgramWalletBlockchainData>
{
  // Статические поля ключей для поиска и синхронизации
  private static primary_key = 'id';
  private static sync_key = 'username';

  // Специфичные поля для program-wallet
  public id?: number; // ID в блокчейне

  // Поля из блокчейна (wallets.hpp)
  public username: IProgramWalletBlockchainData['username'];

  public coopname?: IProgramWalletBlockchainData['coopname'];
  public last_program_crps?: IProgramWalletBlockchainData['last_program_crps'];
  public capital_available?: IProgramWalletBlockchainData['capital_available'];

  /**
   * Конструктор для сборки композитной сущности
   *
   * @param databaseData - данные из базы данных
   * @param blockchainData - данные из блокчейна
   */
  constructor(databaseData: IProgramWalletDatabaseData, blockchainData?: IProgramWalletBlockchainData) {
    // Вызываем конструктор базового класса с данными
    super(databaseData);

    // Специфичные поля для program-wallet
    this.username = databaseData.username;

    // Данные из блокчейна
    if (blockchainData) {
      if (this.username != blockchainData.username) throw new Error('Program wallet username mismatch');

      this.id = Number(blockchainData.id);
      this.coopname = blockchainData.coopname;
      this.username = blockchainData.username;
      this.last_program_crps = blockchainData.last_program_crps;
      this.capital_available = blockchainData.capital_available;
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
    return ProgramWalletDomainEntity.primary_key;
  }

  /**
   * Получение ключа для синхронизации сущности в блокчейне и базе данных (статический метод)
   */
  public static getSyncKey(): string {
    return ProgramWalletDomainEntity.sync_key;
  }

  /**
   * Получение ключа для поиска сущности в блокчейне
   */
  getPrimaryKey(): string {
    return ProgramWalletDomainEntity.primary_key;
  }

  /**
   * Получение ключа для синхронизации сущности в блокчейне и базе данных
   */
  getSyncKey(): string {
    return ProgramWalletDomainEntity.sync_key;
  }

  /**
   * Обновление данных из блокчейна
   * Обновляет текущий экземпляр
   */
  updateFromBlockchain(blockchainData: IProgramWalletBlockchainData, blockNum: number, present = true): void {
    this.block_num = blockNum;
    this.present = present;

    // Обновляем все поля из блокчейна
    Object.assign(this, blockchainData);
  }
}
