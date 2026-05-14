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

/**
 * Черновик редактируемой формы отчёта (per-user per-reportType per-period).
 *
 * Хранится вне таблицы `generated_reports`: там история сданных XML,
 * здесь — редактируемое состояние формы до генерации. При autosave
 * делается upsert по уникальному индексу (coopname, owner_username,
 * report_type, year, period) — один пользователь не может вести
 * параллельно два черновика одного и того же отчёта.
 *
 * `edited_fields` — список JSONPath-путей, которые пользователь трогал
 * руками. При buildInitialReportEdits сервер считает дефолты и накладывает
 * поверх только эти поля из drafta → автоподсчётные значения всегда
 * свежие, ручные правки — never overwritten.
 */
@Entity('report_drafts')
@Unique('uq_report_draft_owner_type_period', [
  'coopname',
  'owner_username',
  'report_type',
  'year',
  'period',
])
@Index(['coopname', 'owner_username'])
export class ReportDraftEntity {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ type: 'varchar', length: 64 })
  coopname!: string;

  @Column({ type: 'varchar', length: 255 })
  owner_username!: string;

  @Column({ type: 'varchar', length: 32 })
  report_type!: ReportType;

  @Column({ type: 'int' })
  year!: number;

  @Column({ type: 'int', nullable: true })
  period?: number | null;

  @Column({ type: 'jsonb' })
  edits_json!: unknown;

  @Column({ type: 'jsonb', default: () => "'[]'::jsonb" })
  edited_fields!: string[];

  @CreateDateColumn({ type: 'timestamp with time zone' })
  created_at!: Date;

  @UpdateDateColumn({ type: 'timestamp with time zone' })
  updated_at!: Date;
}
