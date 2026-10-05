import { ChainRecord } from '@coopenomics/extension-kit/sync';
import { ContributorRecord } from './contributor.record';

export const EntityName = 'capital_votes';
export class VoteRecord extends ChainRecord {
  static getTableName(): string {
    return EntityName;
  }
  id!: number;

  // Поля из блокчейна (votes.hpp)
  coopname!: string;
  project_hash!: string;

  voter!: string;

  // Связь с голосующим для получения display_name
  voter_contributor?: ContributorRecord;

  recipient!: string;

  amount!: string;

  voted_at!: Date;

  // Связь с получателем голоса для получения display_name
  recipient_contributor?: ContributorRecord;
}
