import { Inject, Injectable } from '@nestjs/common';
import { BRANCH_BLOCKCHAIN_PORT, type BranchBlockchainPort } from '~/domain/branch/interfaces/branch-blockchain.port';
import { ACCOUNT_BLOCKCHAIN_PORT, type AccountBlockchainPort } from '~/domain/account/interfaces/account-blockchain.port';
import type { MeetRowProcessingDomainInterface } from '../interfaces/meet-row-processing-domain.interface';
import {
  isTrusteesMeet,
  meetVoters,
  resolveMeetParticipation,
  type MeetBranchData,
  type MeetFormData,
  type MeetParticipation,
} from '../utils/meet-voters';

/**
 * Состав голосующих собрания по данным цепи: форма из записи собрания,
 * участки, флаг кооператива (только для собраний без формы) и участок пайщика.
 *
 * Участки читаются из таблицы цепи: зеркала участков в базе узла нет, и
 * остальные чтения участков в ядре устроены так же. Собрание пайщиков с
 * закреплённой формой цепь не читает вовсе.
 */
@Injectable()
export class MeetVotersDomainService {
  constructor(
    @Inject(BRANCH_BLOCKCHAIN_PORT) private readonly branchPort: BranchBlockchainPort,
    @Inject(ACCOUNT_BLOCKCHAIN_PORT) private readonly accountPort: AccountBlockchainPort
  ) {}

  /** Голосующие собрания уполномоченных; `null` — собрание пайщиков, голосуют все. */
  async getVoters(meet: MeetRowProcessingDomainInterface): Promise<string[] | null> {
    const form = this.formOf(meet);
    const cooperativeIsBranched = await this.cooperativeIsBranched(meet.coopname, form);
    if (!isTrusteesMeet(form, cooperativeIsBranched)) return null;
    return meetVoters(form, cooperativeIsBranched, await this.branches(meet.coopname));
  }

  /** Право пайщика на собрании. */
  async getParticipation(meet: MeetRowProcessingDomainInterface, username: string): Promise<MeetParticipation> {
    const form = this.formOf(meet);
    const cooperativeIsBranched = await this.cooperativeIsBranched(meet.coopname, form);
    if (!isTrusteesMeet(form, cooperativeIsBranched)) {
      return resolveMeetParticipation({ form, cooperativeIsBranched, branches: [], username });
    }

    const [branches, participant] = await Promise.all([
      this.branches(meet.coopname),
      this.accountPort.getParticipantAccount(meet.coopname, username),
    ]);
    return resolveMeetParticipation({
      form,
      cooperativeIsBranched,
      branches,
      username,
      userBraname: participant?.braname ? String(participant.braname) : null,
    });
  }

  private formOf(meet: MeetRowProcessingDomainInterface): MeetFormData | null {
    return (meet.form as MeetFormData | undefined) ?? null;
  }

  /** Флаг кооператива нужен только собраниям без закреплённой формы. */
  private async cooperativeIsBranched(coopname: string, form: MeetFormData | null): Promise<boolean> {
    if (form) return false;
    const cooperative = await this.accountPort.getCooperatorAccount(coopname);
    return Boolean(Number(cooperative?.is_branched ?? 0));
  }

  private async branches(coopname: string): Promise<MeetBranchData[]> {
    const rows = await this.branchPort.getBranches(coopname);
    return rows.map((row) => ({
      braname: String(row.braname),
      trustee: String(row.trustee),
      created_at: row.created_at ?? null,
    }));
  }
}
