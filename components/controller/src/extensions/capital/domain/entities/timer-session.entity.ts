export interface TimerSessionDomainInterface {
  _id: string;
  contributor_hash: string;
  issue_hash: string;
  project_hash: string;
  coopname: string;
  started_at: Date;
  stopped_at?: Date | null;
  /** Момент постановки на паузу; null — идёт или остановлена */
  paused_at?: Date | null;
  /** Сумма завершённых пауз в мс (без текущей, если сейчас на паузе) */
  total_paused_ms?: number;
}

export class TimerSessionDomainEntity implements TimerSessionDomainInterface {
  _id!: string;
  contributor_hash!: string;
  issue_hash!: string;
  project_hash!: string;
  coopname!: string;
  started_at!: Date;
  stopped_at?: Date | null;
  paused_at?: Date | null;
  total_paused_ms!: number;

  constructor(data: TimerSessionDomainInterface) {
    Object.assign(this, data);
    this.total_paused_ms = Number(data.total_paused_ms || 0);
    this.paused_at = data.paused_at ?? null;
  }

  get isOpen(): boolean {
    return this.stopped_at == null;
  }

  get isPaused(): boolean {
    return this.isOpen && this.paused_at != null;
  }

  /**
   * Чистое отработанное время сессии (без пауз), в миллисекундах.
   */
  getElapsedMs(now: Date = new Date()): number {
    const end = this.stopped_at ? new Date(this.stopped_at) : now;
    const wall = end.getTime() - new Date(this.started_at).getTime();
    const currentPauseMs =
      this.isOpen && this.paused_at != null ? now.getTime() - new Date(this.paused_at).getTime() : 0;
    return Math.max(0, wall - Number(this.total_paused_ms || 0) - currentPauseMs);
  }
}
