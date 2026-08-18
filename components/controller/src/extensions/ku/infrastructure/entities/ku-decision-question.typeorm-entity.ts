import { Entity, Column, Index } from 'typeorm';
import { BaseTypeormEntity } from '@coopenomics/extension-kit/sync';

export const EntityName = 'ku_decision_questions';

@Entity(EntityName)
@Index(`idx_${EntityName}_blockchain_id`, ['id'])
@Index(`idx_${EntityName}_decision_id`, ['decision_id'])
@Index(`idx_${EntityName}_coopname`, ['coopname'])
export class KuDecisionQuestionTypeormEntity extends BaseTypeormEntity {
  static getTableName(): string {
    return EntityName;
  }

  @Column({ type: 'integer', nullable: true })
  id!: number;

  // Поля из блокчейна (table_branch_decisions.hpp, таблица decisionq)
  @Column({ type: 'integer' })
  decision_id!: number;

  @Column({ type: 'integer' })
  number!: number;

  @Column({ type: 'varchar', length: 12 })
  coopname!: string;

  @Column({ type: 'text' })
  title!: string;

  @Column({ type: 'text' })
  decision!: string;

  @Column({ type: 'text', default: '' })
  context!: string;

  @Column({ type: 'integer', default: 0 })
  counter_votes_for!: number;

  @Column({ type: 'integer', default: 0 })
  counter_votes_against!: number;

  @Column({ type: 'integer', default: 0 })
  counter_votes_abstained!: number;

  @Column({ type: 'jsonb', default: () => `'[]'` })
  voters_for!: string[];

  @Column({ type: 'jsonb', default: () => `'[]'` })
  voters_against!: string[];

  @Column({ type: 'jsonb', default: () => `'[]'` })
  voters_abstained!: string[];
}
