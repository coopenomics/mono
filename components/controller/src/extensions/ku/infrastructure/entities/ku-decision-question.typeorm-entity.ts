import { ChainRecord } from '@coopenomics/extension-kit/sync';

export const EntityName = 'ku_decision_questions';

export class KuDecisionQuestionTypeormEntity extends ChainRecord {
  static getTableName(): string {
    return EntityName;
  }

  id!: number;

  // Поля из блокчейна (table_branch_decisions.hpp, таблица decisionq)
  decision_id!: number;

  number!: number;

  coopname!: string;

  title!: string;

  decision!: string;

  context!: string;

  counter_votes_for!: number;

  counter_votes_against!: number;

  counter_votes_abstained!: number;

  voters_for!: string[];

  voters_against!: string[];

  voters_abstained!: string[];
}
