import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn, UpdateDateColumn } from 'typeorm';

export const EntityName = 'coop_cpp_registry';

@Entity(EntityName)
@Index(`uq_${EntityName}_required_for_extension`, ['required_for_extension'], { unique: true })
export class CppRegistryEntryTypeormEntity {
  static getTableName(): string {
    return EntityName;
  }

  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'integer' })
  template_document_registry_id!: number;

  @Column({ type: 'varchar', length: 64 })
  required_for_extension!: string;

  @Column({ type: 'boolean', default: true })
  mvp_hardcoded!: boolean;

  @CreateDateColumn({ type: 'timestamptz' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updated_at!: Date;
}
