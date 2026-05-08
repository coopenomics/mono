import { Entity, Column, Index } from 'typeorm';
import type { IProgramAgreement } from '~/domain/wallet/interfaces/user-agreement-blockchain.interface';
import { BaseTypeormEntity } from '~/shared/sync/entities/base-typeorm.entity';

export const EntityName = 'user_agreements';

/**
 * Owner программных соглашений (`wallet::users`).
 *
 * Одна строка на (coopname, username); `programs` хранится как jsonb-массив
 * `IProgramAgreement[]`. Удалённая запись блокчейна → `present=false`,
 * строка остаётся для версионирования и форк-процедур.
 */
@Entity(EntityName)
@Index(`idx_${EntityName}_coopname`, ['coopname'])
@Index(`idx_${EntityName}_username`, ['username'])
@Index(`idx_${EntityName}_coopname_username`, ['coopname', 'username'], { unique: true })
export class UserAgreementTypeormEntity extends BaseTypeormEntity {
  static getTableName(): string {
    return EntityName;
  }

  @Column({ type: 'varchar', length: 12 })
  coopname!: string;

  @Column({ type: 'varchar', length: 12 })
  username!: string;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  programs!: IProgramAgreement[];
}
