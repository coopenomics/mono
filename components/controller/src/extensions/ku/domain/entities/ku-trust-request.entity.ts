import type { IBlockchainSynchronizable } from '~/shared/interfaces/blockchain-sync.interface';
import { BaseDomainEntity } from '~/shared/sync/entities/base-domain.entity';
import type {
  IKuTrustRequestBlockchainData,
  IKuTrustRequestDatabaseData,
} from '../interfaces/ku-blockchain-data.interface';

/**
 * Доменная сущность заявки на приём доверенным лицом кооперативного участка
 * (таблица trustreqs контракта branch).
 */
export class KuTrustRequestDomainEntity
  extends BaseDomainEntity<IKuTrustRequestDatabaseData>
  implements IBlockchainSynchronizable, Partial<IKuTrustRequestBlockchainData>
{
  private static primary_key = 'hash';
  private static sync_key = 'hash';

  public id?: number;
  public hash?: string;
  public coopname?: string;
  public braname?: string;
  public username?: string;
  public application?: IKuTrustRequestBlockchainData['application'];
  public authority?: IKuTrustRequestBlockchainData['authority'];

  constructor(databaseData: IKuTrustRequestDatabaseData, blockchainData?: IKuTrustRequestBlockchainData) {
    super(databaseData, 'pending');

    if (blockchainData) {
      this.updateFromBlockchain(blockchainData, databaseData.block_num ?? 0, databaseData.present);
    }
  }

  getBlockNum(): number | undefined {
    return this.block_num;
  }

  public static getPrimaryKey(): string {
    return KuTrustRequestDomainEntity.primary_key;
  }

  public static getSyncKey(): string {
    return KuTrustRequestDomainEntity.sync_key;
  }

  getPrimaryKey(): string {
    return KuTrustRequestDomainEntity.primary_key;
  }

  getSyncKey(): string {
    return KuTrustRequestDomainEntity.sync_key;
  }

  updateFromBlockchain(blockchainData: IKuTrustRequestBlockchainData, blockNum: number, present = true): void {
    this.block_num = blockNum;
    this.present = present;

    this.id = Number(blockchainData.id);
    this.hash = blockchainData.hash?.toLowerCase();
    this.coopname = blockchainData.coopname;
    this.braname = blockchainData.braname;
    this.username = blockchainData.username;
    this.application = blockchainData.application;
    this.authority = blockchainData.authority;
  }
}
