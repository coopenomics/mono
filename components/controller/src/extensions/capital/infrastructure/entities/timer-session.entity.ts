import { ChainRecord } from '@coopenomics/extension-kit/sync';

/**
 * Открытая/закрытая сессия таймера участника (максимум одна открытая на contributor).
 */
export class TimerSessionEntity extends ChainRecord {
  contributor_hash!: string;

  issue_hash!: string;

  project_hash!: string;

  coopname!: string;

  started_at!: Date;

  stopped_at?: Date | null;

  paused_at?: Date | null;

  total_paused_ms!: number;
}
