import { Entity, Column, CreateDateColumn, Index, OneToMany } from 'typeorm';
import { CycleStatus } from '../../domain/enums/cycle-status.enum';
import { IssueTypeormEntity } from './issue.typeorm-entity';
import { BaseTypeormEntity } from '~/shared/sync/entities/base-typeorm.entity';

export const EntityName = 'capital_cycles';
@Entity(EntityName)
@Index(`idx_${EntityName}_status`, ['status'])
@Index(`idx_${EntityName}_created_at`, ['_created_at'])
export class CycleTypeormEntity extends BaseTypeormEntity {
  @Column({ type: 'varchar' })
  name!: string;

  @Column({ type: 'date' })
  start_date!: Date;

  @Column({ type: 'date' })
  end_date!: Date;

  @Column({
    type: 'enum',
    enum: CycleStatus,
    default: CycleStatus.FUTURE,
  })
  status!: CycleStatus;

  // Связи
  @OneToMany(() => IssueTypeormEntity, (issue) => issue.cycle, { cascade: true })
  issues!: IssueTypeormEntity[];
}
