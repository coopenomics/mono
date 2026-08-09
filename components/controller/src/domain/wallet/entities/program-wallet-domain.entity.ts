import type { IBlockchainSynchronizable } from '@coopenomics/extension-kit/sync';
import type { IProgramWalletBlockchainData } from '../interfaces/program-wallet-blockchain.interface';
import type { IProgramWalletDatabaseData } from '../interfaces/program-wallet-database.interface';
import { BaseDomainEntity } from '@coopenomics/extension-kit/sync';
import { ProgramType, getProgramType } from '../enums/program-type.enum';

/**
 * Доменная сущность программного кошелька
 * Представляет кошелек участника в целевой потребительской программе кооператива
 */
export class ProgramWalletDomainEntity
  extends BaseDomainEntity<IProgramWalletDatabaseData>
  implements IBlockchainSynchronizable, Partial<IProgramWalletBlockchainData>
{
  // Статические ключи для синхронизации
  private static primary_key = 'id';
  private static sync_key = 'id';

  /** Уникальный идентификатор кошелька в блокчейне */
  public id?: string;

  /** Имя кооператива */
  public coopname?: string;

  /** Идентификатор программы */
  public program_id?: string;

  /** Тип программы (вычисляется автоматически на основе program_id) */
  public program_type?: ProgramType;

  /** Идентификатор соглашения */
  public agreement_id?: string;

  /** Имя пользователя */
  public username?: string;

  /** Доступный баланс */
  public available?: string;

  /** Заблокированный баланс */
  public blocked?: string;

  /** Паевой взнос */
  public membership_contribution?: string;

  constructor(databaseData: IProgramWalletDatabaseData, blockchainData?: IProgramWalletBlockchainData) {
    // Вызываем конструктор базового класса - это создаст _id и другие базовые поля
    super(databaseData);

    // Инициализируем поля из блокчейна
    if (blockchainData) {
      this.id = blockchainData.id;
      this.coopname = blockchainData.coopname;
      this.program_id = blockchainData.program_id;
      this.agreement_id = blockchainData.agreement_id;
      this.username = blockchainData.username;
      this.available = blockchainData.available;
      this.blocked = blockchainData.blocked;
      this.membership_contribution = blockchainData.membership_contribution;
      this.program_type = getProgramType(blockchainData.program_id);
    }
  }

  // Статические методы для получения ключей
  public static getPrimaryKey(): string {
    return ProgramWalletDomainEntity.primary_key;
  }

  public static getSyncKey(): string {
    return ProgramWalletDomainEntity.sync_key;
  }

  // Реализация IBlockchainSynchronizable
  getPrimaryKey(): string {
    return this.id || '';
  }

  getSyncKey(): string {
    return this.id || '';
  }

  getBlockNum(): number | undefined {
    return this.block_num;
  }

  /**
   * Обновить сущность данными из блокчейна
   */
  updateFromBlockchain(data: IProgramWalletBlockchainData, blockNum: number, present = true): void {
    this.id = data.id;
    this.coopname = data.coopname;
    this.program_id = data.program_id;
    this.agreement_id = data.agreement_id;
    this.username = data.username;
    this.available = data.available;
    this.blocked = data.blocked;
    this.membership_contribution = data.membership_contribution;
    this.program_type = getProgramType(data.program_id);
    this.block_num = blockNum;
    this.present = present;
  }
}
