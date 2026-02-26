import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';
import { ProcessInstanceStatus } from '../../domain/enums/process-status.enum';
import type { ProcessStepState } from '../../domain/entities/process-instance.entity';

@Entity('capital_process_instances')
export class ProcessInstanceTypeormEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 12 })
  coopname!: string;

  @Column({ type: 'uuid' })
  template_id!: string;

  @Column({ type: 'varchar' })
  project_hash!: string;

  @Column({ type: 'enum', enum: ProcessInstanceStatus, default: ProcessInstanceStatus.RUNNING })
  status!: ProcessInstanceStatus;

  @Column({ type: 'varchar', length: 50 })
  started_by!: string;

  @Column({ type: 'int', default: 1 })
  cycle!: number;

  @Column({ type: 'jsonb', default: '[]' })
  step_states!: ProcessStepState[];

  @CreateDateColumn()
  started_at!: Date;

  @Column({ type: 'timestamp', nullable: true })
  completed_at?: Date;
}
