import type { TimerSessionDomainEntity } from '../entities/timer-session.entity';

export interface TimerSessionRepository {
  create(session: TimerSessionDomainEntity): Promise<TimerSessionDomainEntity>;
  update(session: TimerSessionDomainEntity): Promise<TimerSessionDomainEntity>;
  findOpenByContributor(contributorHash: string): Promise<TimerSessionDomainEntity | null>;
  findById(id: string): Promise<TimerSessionDomainEntity | null>;
  /** Все открытые сессии (для авто-стопа по суточному лимиту). */
  findAllOpen(): Promise<TimerSessionDomainEntity[]>;
}

export const TIMER_SESSION_REPOSITORY = Symbol('TimerSessionRepository');
