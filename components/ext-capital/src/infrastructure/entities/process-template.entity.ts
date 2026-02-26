import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { ProcessTemplateStatus } from '../../domain/enums/process-status.enum';
import type { ProcessStepTemplate, ProcessEdge } from '../../domain/entities/process-template.entity';

@Entity('capital_process_templates')
export class ProcessTemplateTypeormEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 12 })
  coopname!: string;

  @Column({ type: 'varchar' })
  project_hash!: string;

  @Column({ type: 'varchar', length: 255 })
  title!: string;

  @Column({ type: 'text', nullable: true })
  description?: string;

  @Column({ type: 'enum', enum: ProcessTemplateStatus, default: ProcessTemplateStatus.DRAFT })
  status!: ProcessTemplateStatus;

  @Column({ type: 'varchar', length: 50 })
  created_by!: string;

  @Column({ type: 'jsonb', default: '[]' })
  steps!: ProcessStepTemplate[];

  @Column({ type: 'jsonb', default: '[]' })
  edges!: ProcessEdge[];

  @CreateDateColumn()
  created_at!: Date;

  @UpdateDateColumn()
  updated_at!: Date;
}
