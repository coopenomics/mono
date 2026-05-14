import { Entity, Column, PrimaryGeneratedColumn, CreateDateColumn, Index } from 'typeorm';
import { ReportType } from '../../domain/enums/report-type.enum';

/**
 * История генераций XML-отчётов ФНС/ФСС.
 * Уникальности на (coopname, report_type, year, period) намеренно нет —
 * повторная генерация допустима и порождает новую запись.
 */
@Entity('generated_reports')
@Index(['coopname', 'report_type', 'year', 'period'])
@Index(['coopname', 'created_at'])
@Index(['report_type', 'created_at'])
export class GeneratedReportEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 64 })
  @Index()
  coopname!: string;

  @Column({ type: 'varchar', length: 32 })
  report_type!: ReportType;

  @Column({ type: 'int' })
  year!: number;

  @Column({ type: 'int', nullable: true })
  period?: number | null;

  @Column({ type: 'text' })
  xml!: string;

  @Column({ type: 'varchar', length: 255 })
  file_name!: string;

  @Column({ type: 'boolean', default: false })
  is_valid!: boolean;

  @Column({ type: 'jsonb', nullable: true })
  validation_errors?: unknown | null;

  @Column({ type: 'jsonb' })
  organization_snapshot!: unknown;

  @Column({ type: 'jsonb', nullable: true })
  corrections_snapshot?: unknown | null;

  @Column({ type: 'varchar', length: 255 })
  generated_by!: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at!: Date;
}
