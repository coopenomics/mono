import { Entity, Column, Index } from 'typeorm';
import { ProgramPropertyStatus } from '../../domain/enums/program-property-status.enum';
import type { ISignedDocument } from '@coopenomics/innercoop';
import { BaseTypeormEntity } from '@coopenomics/extension-kit/sync';

export const EntityName = 'capital_program_properties';
@Entity(EntityName)
@Index(`idx_${EntityName}_blockchain_id`, ['id'])
@Index(`idx_${EntityName}_property_hash`, ['property_hash'])
@Index(`idx_${EntityName}_username`, ['username'])
@Index(`idx_${EntityName}_status`, ['status'])
@Index(`idx_${EntityName}_created_at`, ['_created_at'])
export class ProgramPropertyTypeormEntity extends BaseTypeormEntity {
  static getTableName(): string {
    return EntityName;
  }
  @Column({ type: 'integer', nullable: true, unique: true })
  id!: number;

  // Поля из блокчейна (program_properties.hpp)
  @Column({ type: 'varchar' })
  coopname!: string;

  @Column({ type: 'varchar' })
  username!: string;

  @Column({ type: 'varchar' })
  blockchain_status!: string;

  @Column({ type: 'varchar' })
  property_hash!: string;

  @Column({ type: 'varchar' })
  property_amount!: string;

  @Column({ type: 'text' })
  property_description!: string;

  @Column({ type: 'json' })
  statement!: ISignedDocument;

  @Column({ type: 'json' })
  authorization!: ISignedDocument;

  @Column({ type: 'json' })
  act!: ISignedDocument;

  @Column({ type: 'timestamp' })
  created_at!: Date;

  // Доменные поля (расширения)
  @Column({
    type: 'enum',
    enum: ProgramPropertyStatus,
    default: ProgramPropertyStatus.CREATED,
  })
  status!: ProgramPropertyStatus;
}
