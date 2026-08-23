import type { IBlockchainSynchronizable } from '@coopenomics/extension-kit/sync';
import { BaseDomainEntity } from '@coopenomics/extension-kit/sync';
import type {
  IKuDecisionQuestionBlockchainData,
  IKuDecisionQuestionDatabaseData,
} from '../interfaces/ku-blockchain-data.interface';

/**
 * Доменная сущность вопроса повестки собрания пайщиков кооперативного участка
 * (таблица decisionq контракта branch).
 */
export class KuDecisionQuestionDomainEntity
  extends BaseDomainEntity<IKuDecisionQuestionDatabaseData>
  implements IBlockchainSynchronizable, Partial<IKuDecisionQuestionBlockchainData>
{
  private static primary_key = 'id';
  private static sync_key = 'id';

  public id?: number;
  public decision_id?: number;
  public number?: number;
  public coopname?: string;
  public title?: string;
  public decision?: string;
  public context?: string;
  public counter_votes_for?: number;
  public counter_votes_against?: number;
  public counter_votes_abstained?: number;
  public voters_for?: string[];
  public voters_against?: string[];
  public voters_abstained?: string[];

  constructor(databaseData: IKuDecisionQuestionDatabaseData, blockchainData?: IKuDecisionQuestionBlockchainData) {
    super(databaseData, 'active');

    if (blockchainData) {
      this.updateFromBlockchain(blockchainData, databaseData.block_num ?? 0, databaseData.present);
    }
  }

  getBlockNum(): number | undefined {
    return this.block_num;
  }

  public static getPrimaryKey(): string {
    return KuDecisionQuestionDomainEntity.primary_key;
  }

  public static getSyncKey(): string {
    return KuDecisionQuestionDomainEntity.sync_key;
  }

  getPrimaryKey(): string {
    return KuDecisionQuestionDomainEntity.primary_key;
  }

  getSyncKey(): string {
    return KuDecisionQuestionDomainEntity.sync_key;
  }

  updateFromBlockchain(blockchainData: IKuDecisionQuestionBlockchainData, blockNum: number, present = true): void {
    this.block_num = blockNum;
    this.present = present;

    this.id = Number(blockchainData.id);
    this.decision_id = Number(blockchainData.decision_id);
    this.number = Number(blockchainData.number);
    this.coopname = blockchainData.coopname;
    this.title = blockchainData.title;
    this.decision = blockchainData.decision;
    this.context = blockchainData.context;
    this.counter_votes_for = Number(blockchainData.counter_votes_for);
    this.counter_votes_against = Number(blockchainData.counter_votes_against);
    this.counter_votes_abstained = Number(blockchainData.counter_votes_abstained);
    this.voters_for = blockchainData.voters_for;
    this.voters_against = blockchainData.voters_against;
    this.voters_abstained = blockchainData.voters_abstained;
  }
}
