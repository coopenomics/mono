import type { IBlockchainSynchronizable } from '~/shared/interfaces/blockchain-sync.interface';
import { BaseDomainEntity } from '~/shared/sync/entities/base-domain.entity';
import type { IKuDecisionBlockchainData, IKuDecisionDatabaseData } from '../interfaces/ku-blockchain-data.interface';

/**
 * Доменная сущность решения собрания пайщиков кооперативного участка.
 * Агрегирует данные базы данных (история сохраняется после erase в блокчейне)
 * и данные таблицы decisions контракта branch.
 */
export class KuDecisionDomainEntity
  extends BaseDomainEntity<IKuDecisionDatabaseData>
  implements IBlockchainSynchronizable, Partial<IKuDecisionBlockchainData>
{
  // Статические поля ключей для поиска и синхронизации
  private static primary_key = 'hash';
  private static sync_key = 'hash';

  public id?: number;
  public hash?: string;
  public coopname?: string;
  public type?: string;
  public initiator?: string;
  public chairman?: string;
  public proposal?: IKuDecisionBlockchainData['proposal'];
  public protocol?: IKuDecisionBlockchainData['protocol'];
  public petition?: IKuDecisionBlockchainData['petition'];
  public liability?: IKuDecisionBlockchainData['liability'];
  public authority?: IKuDecisionBlockchainData['authority'];
  public authorization?: IKuDecisionBlockchainData['authorization'];
  public open_at?: string;
  public close_at?: string;
  public signed_ballots?: number;
  public braname?: string;
  public address?: string;
  public participants?: string[];
  public created_at?: string;

  // Приватные данные собрания — только БД, в блокчейн не публикуются
  public meet_place?: string;
  public meet_at?: Date;
  public branch_name?: string;
  public branch_email?: string;
  public branch_phone?: string;
  public cancelled?: boolean;
  public meet_reminder_sent?: boolean;

  constructor(databaseData: IKuDecisionDatabaseData, blockchainData?: IKuDecisionBlockchainData) {
    super(databaseData);

    this.meet_place = databaseData.meet_place;
    this.meet_at = databaseData.meet_at;
    this.branch_name = databaseData.branch_name;
    this.branch_email = databaseData.branch_email;
    this.branch_phone = databaseData.branch_phone;
    this.cancelled = databaseData.cancelled;
    this.meet_reminder_sent = databaseData.meet_reminder_sent;

    if (blockchainData) {
      this.updateFromBlockchain(blockchainData, databaseData.block_num ?? 0, databaseData.present);
    }
  }

  getBlockNum(): number | undefined {
    return this.block_num;
  }

  public static getPrimaryKey(): string {
    return KuDecisionDomainEntity.primary_key;
  }

  public static getSyncKey(): string {
    return KuDecisionDomainEntity.sync_key;
  }

  getPrimaryKey(): string {
    return KuDecisionDomainEntity.primary_key;
  }

  getSyncKey(): string {
    return KuDecisionDomainEntity.sync_key;
  }

  updateFromBlockchain(blockchainData: IKuDecisionBlockchainData, blockNum: number, present = true): void {
    this.block_num = blockNum;
    this.present = present;

    this.id = Number(blockchainData.id);
    this.hash = blockchainData.hash?.toLowerCase();
    this.coopname = blockchainData.coopname;
    this.type = blockchainData.type;
    this.initiator = blockchainData.initiator;
    this.chairman = blockchainData.chairman;
    // Статус контракта сохраняем в базовое поле status
    this.status = blockchainData.status;
    this.proposal = blockchainData.proposal;
    this.protocol = blockchainData.protocol;
    this.petition = blockchainData.petition;
    this.liability = blockchainData.liability;
    this.authority = blockchainData.authority;
    this.authorization = blockchainData.authorization;
    this.open_at = blockchainData.open_at;
    this.close_at = blockchainData.close_at;
    this.signed_ballots = Number(blockchainData.signed_ballots);
    this.braname = blockchainData.braname;
    this.address = blockchainData.address;
    this.participants = blockchainData.participants;
    this.created_at = blockchainData.created_at;
  }
}
