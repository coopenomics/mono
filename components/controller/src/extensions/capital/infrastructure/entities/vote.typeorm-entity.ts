import { ChainRecord } from '@coopenomics/extension-kit/sync';
import { ContributorTypeormEntity } from './contributor.typeorm-entity';

export const EntityName = 'capital_votes';
export class VoteTypeormEntity extends ChainRecord {
  static getTableName(): string {
    return EntityName;
  }
  id!: number;

  // Поля из блокчейна (votes.hpp)
  coopname!: string;
  project_hash!: string;

  voter!: string;

  // Связь с голосующим для получения display_name
  voter_contributor?: ContributorTypeormEntity;

  recipient!: string;

  amount!: string;

  voted_at!: Date;

  // Связь с получателем голоса для получения display_name
  recipient_contributor?: ContributorTypeormEntity;
}
