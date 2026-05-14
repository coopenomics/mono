import type { IBlockchainSynchronizable } from '~/shared/interfaces/blockchain-sync.interface';
import type {
  IUserAgreementBlockchainData,
  IProgramAgreement,
} from '../interfaces/user-agreement-blockchain.interface';
import type { IUserAgreementDatabaseData } from '../interfaces/user-agreement-database.interface';
import { BaseDomainEntity } from '~/shared/sync/entities/base-domain.entity';

/**
 * Доменная сущность owner'а программных соглашений (`wallet::users`, ADR-008 / Эпик 2).
 *
 * Одна запись на (coopname, username) хранит вектор `programs[]`, отражающий
 * все программные соглашения, подписанные пайщиком в рамках кооператива.
 * `wallet::signagree` upsert'ит элемент, `wallet::revokeagree` удаляет; пустой
 * вектор → запись стирается из state.
 */
export class UserAgreementDomainEntity
  extends BaseDomainEntity<IUserAgreementDatabaseData>
  implements IBlockchainSynchronizable, Partial<IUserAgreementBlockchainData>
{
  private static primary_key = 'username';
  private static sync_key = 'username';

  public coopname?: string;
  public username?: string;
  public programs: IProgramAgreement[] = [];

  constructor(databaseData: IUserAgreementDatabaseData, blockchainData?: IUserAgreementBlockchainData) {
    super(databaseData);

    if (blockchainData) {
      this.coopname = blockchainData.coopname;
      this.username = blockchainData.username;
      this.programs = blockchainData.programs ?? [];
    }
  }

  public static getPrimaryKey(): string {
    return UserAgreementDomainEntity.primary_key;
  }

  public static getSyncKey(): string {
    return UserAgreementDomainEntity.sync_key;
  }

  getPrimaryKey(): string {
    return this.username || '';
  }

  getSyncKey(): string {
    return this.username || '';
  }

  getBlockNum(): number | undefined {
    return this.block_num;
  }

  updateFromBlockchain(data: IUserAgreementBlockchainData, blockNum: number, present = true): void {
    this.coopname = data.coopname;
    this.username = data.username;
    this.programs = data.programs ?? [];
    this.block_num = blockNum;
    this.present = present;
  }

  /**
   * Возвращает программное соглашение по `program_id`, либо `undefined`.
   */
  findProgram(program_id: number | string): IProgramAgreement | undefined {
    const target = Number(program_id);
    return this.programs.find((p) => Number(p.program_id) === target);
  }
}
