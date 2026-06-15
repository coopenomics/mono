import { Inject, Injectable, Logger, type OnModuleInit } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { Workflows } from '@coopenomics/notifications';
import { NotificationSenderService } from '~/application/notification/services/notification-sender.service';
import config from '~/config/config';
import {
  EXPENSE_PROPOSAL_REPOSITORY,
  type ExpenseProposalRepository,
} from '../../domain/repositories/expense-proposal.repository';
import { ExpenseProposalStatus } from '../../domain/enums/expense-proposal-status.enum';
import type { ExpenseProposalDomainEntity } from '../../domain/entities/expense-proposal.entity';
import type { IExpenseItemBlockchainData } from '../../domain/interfaces/expense-proposal-blockchain.interface';

// Зеркала числовых enum контракта `expense` (cpp/expense/expense.hpp).
const MECHANICS_ADVANCE = 0; // Mechanics::ADVANCE — пайщик-получатель отчитывается чеком.
const RECIPIENT_ORG = 2; // RecipientType::ORG — у организации нет личного кабинета.
const ITEM_STATUS_PAID = 1; // ItemStatus::PAID — аванс выдан, отчёт ещё не подан.

// Параметры воркера — ENV-sourced с дефолтами (канон: не hardcode magic numbers,
// тюнинг воркера читаем из process.env как outbox-worker Центра уведомлений).
// Тик опроса зеркала расходов. Дайджест шлётся не чаще раза в неделю — частоту
// тика троттлит идемпотентность Центра (поле `period` в payload), поэтому тик
// можно держать редким: он лишь определяет задержку первого письма после грейса.
const TICK_MS = Number(process.env.EXPENSE_ADVANCE_REMINDER_INTERVAL_MS) || 6 * 60 * 60 * 1000;
// Сколько дней аванс может «висеть» без отчёта до первого напоминания.
const GRACE_DAYS = Number(process.env.EXPENSE_ADVANCE_REMINDER_GRACE_DAYS) || 3;
const DAY_MS = 24 * 60 * 60 * 1000;

interface OutstandingAdvance {
  description: string;
  amount: string;
  proposal_hash: string;
}

/**
 * Фоновый напоминатель об отчёте по авансу под отчёт.
 *
 * Каждый тик сканирует зеркало расходов кооператива и находит ADVANCE-item-ы в
 * статусе PAID (аванс выдан пайщику, отчёт не подан). По каждому пайщику-получателю
 * шлёт один агрегированный дайджест со ссылками на расходы. Кассиру/совету ничего
 * не шлётся — только получателю аванса.
 *
 * Троттлинг «раз в неделю» — через идемпотентность Центра уведомлений: поле `period`
 * (ISO-неделя) делает payload стабильным внутри недели, поэтому повторные тики гасятся,
 * а на новой неделе уходит ровно одно письмо. Своя таблица состояния не нужна.
 *
 * Точка отсчёта грейса — `proposal.updated_at` (последняя операция со СЗ; для PAID-не-
 * REPORTED item-а это фактически момент выплаты), с фолбэком на `created_at`. Срок из
 * заявления пайщика (deadline) сейчас не доезжает до цепи — это осознанный fallback,
 * точная семантика «просрочен по дате» — отдельный апгрейд контракта (см. README).
 */
@Injectable()
export class ExpenseAdvanceReminderService implements OnModuleInit {
  private readonly logger = new Logger(ExpenseAdvanceReminderService.name);
  // Гард от наложения тиков (single-instance): длинный тик не запускается повторно.
  private isRunning = false;

  constructor(
    @Inject(EXPENSE_PROPOSAL_REPOSITORY)
    private readonly proposals: ExpenseProposalRepository,
    private readonly notificationSender: NotificationSenderService
  ) {}

  onModuleInit(): void {
    this.logger.log(
      `Напоминатель об отчёте по авансу запущен: тик ${Math.round(TICK_MS / 60000)} мин, грейс ${GRACE_DAYS} дн`
    );
  }

  @Interval('expense-advance-report-reminder', TICK_MS)
  async tick(): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    try {
      await this.processCoop(config.coopname);
    } catch (error: any) {
      this.logger.error(`Ошибка тика напоминателя авансов: ${error.message}`, error.stack);
    } finally {
      this.isRunning = false;
    }
  }

  private async processCoop(coopname: string): Promise<void> {
    const proposals = await this.proposals.findByCoopname(coopname);
    const now = Date.now();

    // Группируем «висящие» авансы по пайщику-получателю.
    const byUser = new Map<string, OutstandingAdvance[]>();
    for (const proposal of proposals) {
      if (!this.isPayablePhase(proposal.status)) continue;
      const anchorMs = this.anchorMs(proposal);
      if (anchorMs === null || now - anchorMs < GRACE_DAYS * DAY_MS) continue;

      for (const item of proposal.items ?? []) {
        if (!this.isOutstandingAdvance(item)) continue;
        const username = item.recipient || proposal.username;
        if (!username) continue;
        const list = byUser.get(username) ?? [];
        list.push({
          // Выданная сумма аванса — то, по чему пайщик отчитывается. actual_amount
          // дрейфует от возвратов/перерасходов (settlement), поэтому не используем.
          description: item.description,
          amount: item.planned_amount,
          proposal_hash: proposal.proposal_hash,
        });
        byUser.set(username, list);
      }
    }

    if (byUser.size === 0) return;
    this.logger.debug(`Напоминания об авансах: пайщиков к уведомлению ${byUser.size}`);

    for (const [username, advances] of byUser) {
      await this.sendDigest(coopname, username, advances);
    }
  }

  private async sendDigest(coopname: string, username: string, advances: OutstandingAdvance[]): Promise<void> {
    const base = `${config.frontend_url}/${coopname}/expenses`;
    // Один аванс — ведём прямо на сам расход; несколько — на личную страницу
    // «Платежи» пайщика (там строки авансов с панелью «приложить чек/отчитаться»).
    const link =
      advances.length === 1
        ? `${base}/${advances[0].proposal_hash}`
        : `${config.frontend_url}/${coopname}/user/payments`;

    const payload: Workflows.ExpenseAdvanceReportReminder.IPayload = {
      coopName: coopname,
      period: isoWeekBucket(new Date()),
      count: advances.length,
      link,
      advances: advances.map((advance) => ({
        description: advance.description,
        amount: advance.amount,
        url: `${base}/${advance.proposal_hash}`,
      })),
    };

    try {
      await this.notificationSender.sendNotificationToUser(
        username,
        Workflows.ExpenseAdvanceReportReminder.id,
        payload
      );
    } catch (error: any) {
      // Нет subscriber_id/email у аккаунта (системный/служебный) — не валим цикл.
      this.logger.warn(`Не удалось отправить напоминание об авансе пайщику ${username}: ${error.message}`);
    }
  }

  private isPayablePhase(status: ExpenseProposalStatus): boolean {
    // Аванс мог быть выдан в AUTHORIZED (одна позиция) или PARTIALLY_PAID (часть позиций).
    // REPORT_SUBMITTED/CLOSED/DECLINED — расход уже без открытого подотчёта.
    return status === ExpenseProposalStatus.AUTHORIZED || status === ExpenseProposalStatus.PARTIALLY_PAID;
  }

  private isOutstandingAdvance(item: IExpenseItemBlockchainData): boolean {
    return (
      item.mechanics === MECHANICS_ADVANCE &&
      item.status === ITEM_STATUS_PAID &&
      item.recipient_type !== RECIPIENT_ORG
    );
  }

  private anchorMs(proposal: ExpenseProposalDomainEntity): number | null {
    const raw = proposal.updated_at || proposal.created_at;
    if (!raw) return null;
    const ms = Date.parse(raw);
    return Number.isNaN(ms) ? null : ms;
  }
}

/**
 * ISO-8601 номер недели в формате `YYYY-Www` — техническая «корзина» троттлинга.
 * Один пайщик + одна неделя → стабильный payload → идемпотентность Центра гасит повтор.
 */
function isoWeekBucket(d: Date): string {
  const date = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dayNum = date.getUTCDay() || 7; // Пн=1…Вс=7
  date.setUTCDate(date.getUTCDate() + 4 - dayNum); // ближайший четверг определяет ISO-год недели
  const yearStart = new Date(Date.UTC(date.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((date.getTime() - yearStart.getTime()) / DAY_MS + 1) / 7);
  return `${date.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}
