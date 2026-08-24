import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { NOTIFICATION_PORT, type INotificationPort } from '@coopenomics/innercoop';
import { Workflows } from '@coopenomics/notifications';
import { AmountFormatterUtils, platformSettings } from '@coopenomics/extension-kit';
import { DEBT_REPOSITORY, type DebtRepository } from '../../domain/repositories/debt.repository';
import { CAPITAL_BLOCKCHAIN_PORT, type CapitalBlockchainPort } from '../../domain/interfaces/capital-blockchain.port';
import { DebtStatus } from '../../domain/enums/debt-status.enum';

// Как часто сверяются сроки возврата. Раз в сутки достаточно: срок займа —
// год, и точность до часа здесь ничего не решает.
const TICK_MS = Number(process.env.CAPITAL_DEBT_TERM_INTERVAL_MS) || 24 * 60 * 60 * 1000;

// За сколько дней до срока пайщику уходит напоминание.
const REMIND_BEFORE_DAYS = Number(process.env.CAPITAL_DEBT_REMIND_BEFORE_DAYS) || 14;

// Цепь за один вызов переводит в просрочку ограниченное число займов
// (см. markdebtoverd), поэтому вызов повторяется. Предел раундов защищает
// от бесконечного цикла, если цепь перестала отвечать ожидаемым образом.
const CHAIN_BATCH_SIZE = 25;
const MAX_SWEEP_ROUNDS = 20;

const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Сверяет сроки возврата займов.
 *
 * Раз в сутки: переводит в просрочку займы, срок которых прошёл, и напоминает
 * пайщикам о приближении срока. Просрочка ничего не отнимает у пайщика — заём
 * по-прежнему закрывается возвратом денег или сдачей результата, — но
 * кооператив видит такие займы отдельно, а пайщик узнаёт о сроке заранее.
 *
 * Повторные уведомления гасит сам центр уведомлений: он идемпотентен по
 * получателю и содержимому, поэтому своя таблица отправленного не нужна.
 */
@Injectable()
export class DebtTermSchedulerService implements OnModuleInit {
  private readonly logger = new Logger(DebtTermSchedulerService.name);
  // Длинный проход не запускается повторно, пока идёт предыдущий.
  private isRunning = false;

  constructor(
    @Inject(DEBT_REPOSITORY) private readonly debts: DebtRepository,
    @Inject(CAPITAL_BLOCKCHAIN_PORT) private readonly chain: CapitalBlockchainPort,
    @Inject(NOTIFICATION_PORT) private readonly notifications: INotificationPort
  ) {}

  async onModuleInit(): Promise<void> {
    this.logger.log(`Сверка сроков возврата займов включена, период ${Math.round(TICK_MS / 1000)} с`);
  }

  @Interval(TICK_MS)
  async tick(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;

    try {
      const coopname = platformSettings().coopname;

      await this.sweepOverdueInChain(coopname);
      await this.remindAboutUpcomingTerms(coopname);
      await this.notifyOverdue(coopname);
    } catch (error) {
      this.logger.error('Сверка сроков возврата займов не удалась', error);
    } finally {
      this.isRunning = false;
    }
  }

  /**
   * Переводит в просрочку займы с истёкшим сроком.
   *
   * Сколько раз позвать цепь, считается по зеркалу: цепь за раз обрабатывает
   * ограниченное число займов и не сообщает, сколько осталось.
   */
  private async sweepOverdueInChain(coopname: string): Promise<void> {
    const expired = (await this.debts.findByStatus(DebtStatus.PAID)).filter((debt) => this.isExpired(debt.due_at));
    if (expired.length === 0) return;

    const rounds = Math.min(Math.ceil(expired.length / CHAIN_BATCH_SIZE), MAX_SWEEP_ROUNDS);
    for (let round = 0; round < rounds; round++) {
      await this.chain.markOverdueDebts({ coopname });
    }

    this.logger.log(`Займов с истёкшим сроком: ${expired.length}, вызовов цепи: ${rounds}`);
  }

  /**
   * Напоминает пайщикам о приближении срока возврата.
   */
  private async remindAboutUpcomingTerms(coopname: string): Promise<void> {
    const now = Date.now();
    const upcoming = (await this.debts.findByStatus(DebtStatus.PAID)).filter((debt) => {
      if (!debt.due_at) return false;
      const daysLeft = Math.ceil((new Date(debt.due_at).getTime() - now) / DAY_MS);
      return daysLeft > 0 && daysLeft <= REMIND_BEFORE_DAYS;
    });

    for (const debt of upcoming) {
      if (!debt.username || !debt.due_at) continue;
      const daysLeft = Math.ceil((new Date(debt.due_at).getTime() - now) / DAY_MS);

      await this.notifications.notifyUser(debt.username, Workflows.CapitalDebtDueSoon.id, {
        borrowerName: debt.username,
        amount: AmountFormatterUtils.formatAmountSafe(String(debt.amount)),
        dueDate: this.formatDate(debt.due_at),
        daysLeft: String(daysLeft),
        coopname,
      });
    }
  }

  /**
   * Сообщает пайщикам о займах, срок которых уже прошёл.
   */
  private async notifyOverdue(coopname: string): Promise<void> {
    const overdue = await this.debts.findByStatus(DebtStatus.OVERDUE);

    for (const debt of overdue) {
      if (!debt.username) continue;

      await this.notifications.notifyUser(debt.username, Workflows.CapitalDebtOverdue.id, {
        borrowerName: debt.username,
        amount: AmountFormatterUtils.formatAmountSafe(String(debt.amount)),
        dueDate: debt.due_at ? this.formatDate(debt.due_at) : '',
        coopname,
      });
    }
  }

  private isExpired(dueAt?: string): boolean {
    if (!dueAt) return false;
    return new Date(dueAt).getTime() < Date.now();
  }

  private formatDate(value: string): string {
    return new Date(value).toLocaleDateString('ru-RU');
  }
}
