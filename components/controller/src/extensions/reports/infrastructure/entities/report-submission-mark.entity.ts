import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  Unique,
} from 'typeorm';
import { ReportType } from '../../domain/enums/report-type.enum';
import { ReportSubmissionMark } from '../../domain/enums/report-submission-mark.enum';

/**
 * Отметка на ячейке календаря — coop-wide (не per-user).
 *
 * Не путать с `ReportDraftEntity`: черновик — персональное
 * редактируемое состояние, а эта сущность — решение кооператива
 * «этот период не сдаём». Хранится отдельно, чтобы отметка
 * не терялась при удалении drafta и не мешала autosave-семантике.
 *
 * `created_by` — username, который нажал «Не надо сдавать».
 * Используется только для аудита (в UI не показываем).
 */
@Entity('report_submission_marks')
@Unique('uq_report_submission_mark_period', ['coopname', 'report_type', 'year', 'period'])
@Index(['coopname', 'report_type', 'year'])
export class ReportSubmissionMarkEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 64 })
  coopname!: string;

  @Column({ type: 'varchar', length: 32 })
  report_type!: ReportType;

  @Column({ type: 'int' })
  year!: number;

  @Column({ type: 'int', nullable: true })
  period?: number | null;

  @Column({ type: 'varchar', length: 32 })
  mark!: ReportSubmissionMark;

  @Column({ type: 'varchar', length: 255 })
  created_by!: string;

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at!: Date;
}
