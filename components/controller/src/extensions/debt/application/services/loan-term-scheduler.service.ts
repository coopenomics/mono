import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { Workflows } from '@coopenomics/notifications';
import { AmountFormatterUtils, platformSettings } from '@coopenomics/extension-kit';
import { NOTIFICATION_PORT, type INotificationPort } from '@coopenomics/innercoop';
import { LOAN_REPOSITORY, type LoanRepository } from '../../domain/repositories/loan.repository';
import { DEBT_BLOCKCHAIN_PORT, type DebtBlockchainPort } from '../../domain/interfaces/debt-blockchain.port';
import { LoanStatus } from '../../domain/enums/loan-status.enum';
import type { LoanDomainEntity } from '../../domain/entities/loan.entity';

// Как часто сверяются сроки возврата. Раз в сутки достаточно: срок займа
// считается месяцами, точность до часа здесь ничего не решает.
const TICK_MS = Number(process.env.DEBT_TERM_INTERVAL_MS) || 24 * 60 * 60 * 1000;

// За сколько дней до срока пайщику уходит напоминание.
const REMIND_BEFORE_DAYS = Number(process.env.DEBT_REMIND_BEFORE_DAYS) || 14;

// Срок после перехода в просрочку, по истечении которого обеспечение
// обращается в пользу кооператива (в контракте — GRACE_SECONDS).
const GRACE_DAYS = 5;

// Цепь за один вызов обрабатывает ограниченное число займов (SWEEP_MAX),
// поэтому вызов повторяется. Предел раундов защищает от бесконечного цикла.
const CHAIN_BATCH_SIZE = 25;
const MAX_SWEEP_ROUNDS = 20;

const DAY_MS = 24 * 60 * 60 * 1000;

/** Время цепи без зоны — это UTC. */
function chainTime(value?: string): number {
  if (!value || value.startsWith('1970')) return 0;
  return new Date(value.endsWith('Z') ? value : `${value}Z`).getTime();
}

/**
 * Сверка сроков возврата займов.
 *
 * Раз в сутки: напоминает пайщикам о приближении срока и зовёт сверку цепи,
 * которая переводит в просрочку займы с истёкшим сроком и через пять дней
 * просрочки обращает обеспечение в пользу кооператива. Сколько раз позвать
 * цепь, считается по зеркалу: цепь не сообщает, сколько займов осталось.
 *
 * О переходе в просрочку и о списании пайщику сообщает слушатель событий
 * займа; повторы гасит центр уведомлений — он идемпотентен по получателю и
 * содержимому.
 */
@Injectable()
export class LoanTermSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(LoanTermSchedulerService.name);
  // Длинный проход не запускается повторно, пока идёт предыдущий.
  private isRunning = false;

  constructor(
    @Inject(LOAN_REPOSITORY) private readonly loans: LoanRepository,
    @Inject(DEBT_BLOCKCHAIN_PORT) private readonly chain: DebtBlockchainPort,
    @Inject(NOTIFICATION_PORT) private readonly notifications: INotificationPort
  ) {}

  onModuleInit(): void {
    this.logger.log(`Сверка сроков возврата займов включена, период ${Math.round(TICK_MS / 60000)} мин`);
  }

  @Interval('debt-loan-term-scheduler', TICK_MS)
  async tick(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    try {
      const coopname = platformSettings().coopname;
      await this.sweep(coopname);
      await this.remindAboutUpcomingTerms(coopname);
    } catch (error) {
      this.logger.error('Сверка сроков возврата займов не удалась', error);
    } finally {
      this.isRunning = false;
    }
  }

  /** Перевод в просрочку и обращение обеспечения: вызовов цепи — по числу займов к обработке. */
  async sweep(coopname: string, now = Date.now()): Promise<number> {
    const issued = await this.loans.findByStatus(coopname, LoanStatus.ISSUED);
    const overdue = await this.loans.findByStatus(coopname, LoanStatus.OVERDUE);

    const expired = issued.filter((loan) => this.isExpired(loan, now));
    // Обеспечение есть только у займов контракта займов; чужие остаются в просрочке.
    const toSeize = overdue.filter(
      (loan) => loan.isOwn && chainTime(loan.overdue_at) > 0 && chainTime(loan.overdue_at) + GRACE_DAYS * DAY_MS <= now
    );

    const pending = expired.length + toSeize.length;
    if (pending === 0) return 0;

    const rounds = Math.min(Math.ceil(pending / CHAIN_BATCH_SIZE), MAX_SWEEP_ROUNDS);
    for (let round = 0; round < rounds; round++) {
      await this.chain.sweep({ coopname, limit: CHAIN_BATCH_SIZE });
    }
    this.logger.log(
      `Займов с истёкшим сроком: ${expired.length}, к обращению обеспечения: ${toSeize.length}, вызовов цепи: ${rounds}`
    );
    return rounds;
  }

  /** Напоминание о приближении срока возврата. */
  async remindAboutUpcomingTerms(coopname: string, now = Date.now()): Promise<number> {
    const issued = await this.loans.findByStatus(coopname, LoanStatus.ISSUED);
    let sent = 0;
    for (const loan of issued) {
      const due = chainTime(loan.due_at);
      if (!loan.username || !due) continue;
      const daysLeft = Math.ceil((due - now) / DAY_MS);
      if (daysLeft <= 0 || daysLeft > REMIND_BEFORE_DAYS) continue;

      try {
        // Число дней в содержимом нет: напоминание по займу и сроку уходит один раз.
        await this.notifications.notifyUser(loan.username, Workflows.LoanDueSoon.id, {
          coopName: coopname,
          contractNumber: loan.debt_hash.slice(0, 8).toUpperCase(),
          amount: AmountFormatterUtils.formatAmountSafe(String(loan.remaining ?? loan.amount ?? '')),
          dueAt: String(loan.due_at).slice(0, 10),
          link: `${platformSettings().frontendUrl}/${coopname}/debt/loans`,
          kind: loan.isOwn ? 'share' : 'generation',
        });
        sent += 1;
      } catch (error: any) {
        this.logger.warn(`Напоминание о сроке по займу ${loan.debt_hash} не отправлено: ${error.message}`);
      }
    }
    return sent;
  }

  private isExpired(loan: LoanDomainEntity, now: number): boolean {
    const due = chainTime(loan.due_at);
    return due > 0 && due < now;
  }
}
