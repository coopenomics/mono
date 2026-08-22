import { Entity, Column, Index } from 'typeorm';
import { BaseTypeormEntity } from '@coopenomics/extension-kit/sync';

export const EntityName = 'program_wallets';

/**
 * TypeORM сущность для программных кошельков
 * Хранит информацию о балансах пайщиков в целевых потребительских программах кооператива
 */
@Entity(EntityName)
@Index(`idx_${EntityName}_blockchain_id`, ['id'])
@Index(`idx_${EntityName}_coopname`, ['coopname'])
@Index(`idx_${EntityName}_username`, ['username'])
@Index(`idx_${EntityName}_program_id`, ['program_id'])
@Index(`idx_${EntityName}_username_program_id`, ['username', 'program_id'])
export class ProgramWalletTypeormEntity extends BaseTypeormEntity {
  static getTableName(): string {
    return EntityName;
  }

  @Column({ type: 'varchar', length: 20, unique: true })
  id!: string;

  @Column({ type: 'varchar', length: 12 })
  coopname!: string;

  @Column({ type: 'varchar', length: 20 })
  program_id!: string;

  @Column({ type: 'varchar', length: 20 })
  agreement_id!: string;

  @Column({ type: 'varchar', length: 12 })
  username!: string;

  @Column({ type: 'varchar', length: 50 })
  available!: string;

  @Column({ type: 'varchar', length: 50 })
  blocked!: string;

  @Column({ type: 'varchar', length: 50 })
  membership_contribution!: string;
}
