import type { IBlockchainSynchronizable } from '~/shared/interfaces/blockchain-sync.interface';
import type { IUserWalletBlockchainData } from '../interfaces/user-wallet-blockchain.interface';
import type { IUserWalletDatabaseData } from '../interfaces/user-wallet-database.interface';
import { BaseDomainEntity } from '~/shared/sync/entities/base-domain.entity';

/**
 * Доменная сущность L3 кошелька пайщика (`ledger2::userwallets`, ADR-008 / Эпик 3).
 *
 * Один экземпляр на (coopname, wallet_name, username); агрегат L2-кошелька
 * (`ledger2::wallets`) обязан совпадать с Σ L3 для USER_SHARED-кошельков
 * (NFR2 — пост-мутационный assert в самом контракте).
 */
export class UserWalletDomainEntity
  extends BaseDomainEntity<IUserWalletDatabaseData>
  implements IBlockchainSynchronizable, Partial<IUserWalletBlockchainData>
{
  private static primary_key = 'id';
  private static sync_key = 'id';

  public id?: string;
  public coopname?: string;
  public wallet_name?: string;
  public username?: string;
  public available?: string;
  public blocked?: string;

  constructor(databaseData: IUserWalletDatabaseData, blockchainData?: IUserWalletBlockchainData) {
    super(databaseData);

    if (blockchainData) {
      this.id = blockchainData.id;
      this.coopname = blockchainData.coopname;
      this.wallet_name = blockchainData.wallet_name;
      this.username = blockchainData.username;
      this.available = blockchainData.available;
      this.blocked = blockchainData.blocked;
    }
  }

  public static getPrimaryKey(): string {
    return UserWalletDomainEntity.primary_key;
  }

  public static getSyncKey(): string {
    return UserWalletDomainEntity.sync_key;
  }

  getPrimaryKey(): string {
    return this.id || '';
  }

  getSyncKey(): string {
    return this.id || '';
  }

  getBlockNum(): number | undefined {
    return this.block_num;
  }

  updateFromBlockchain(data: IUserWalletBlockchainData, blockNum: number, present = true): void {
    this.id = data.id;
    this.coopname = data.coopname;
    this.wallet_name = data.wallet_name;
    this.username = data.username;
    this.available = data.available;
    this.blocked = data.blocked;
    this.block_num = blockNum;
    this.present = present;
  }
}
