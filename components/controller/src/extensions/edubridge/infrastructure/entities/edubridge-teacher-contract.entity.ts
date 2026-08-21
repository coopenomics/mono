import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm';

/** Подписанный преподавателем договор участия в хозяйственной деятельности (док. 3006). */
@Entity({ name: 'edubridge_teacher_contracts' })
@Index('IDX_edubridge_teacher_contracts_unique', ['coopname', 'teacher_username'], { unique: true })
export class EdubridgeTeacherContractEntity {
  @PrimaryGeneratedColumn('uuid')
  public id!: string;

  @Column({ type: 'varchar', length: 13 })
  public coopname!: string;

  @Column({ type: 'varchar', length: 13 })
  public teacher_username!: string;

  @Column({ type: 'varchar', length: 64 })
  public contract_hash!: string;

  @Column({ type: 'varchar', length: 32 })
  public contract_number!: string;

  @CreateDateColumn({ type: 'timestamptz' })
  public signed_at!: Date;
}
