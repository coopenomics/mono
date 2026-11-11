import {
  TableStore,
  expensePlanRecurrenceMonths,
  expensePlanReserveMonths,
  expensePlanReserveShare,
  expensePlanScheduleDates,
  lessOrEqual,
  notEqual,
} from '@coopenomics/extension-kit';
import { EXPENSES_PLAN_STORE } from '../../infrastructure/database/expenses-stores';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { OnEvent } from '@nestjs/event-emitter';
import { BranchContract } from 'cooptypes';
import { platformSettings, DomainError } from '@coopenomics/extension-kit';
import { ExpensePlanEntity } from '../../infrastructure/entities/expense-plan.entity';
import { ExpensePlanRecurrence, nextRecurrenceDate } from '../../domain/expense-plan.types';
import { ExpenseProposalStatus } from '../../domain/enums/expense-proposal-status.enum';
import { CHAIN_PORT, type IChainPort, type IMonoAccount } from '@coopenomics/innercoop';

export const EXPENSE_PLANS_SERVICE = Symbol('EXPENSE_PLANS_SERVICE');

function isBranchOperator(branch: BranchContract.Tables.Branches.IBranch, username: string): boolean {
  return branch.trustee === username || branch.trusted.includes(username);
}

/**
 * Горизонт планового резерва расходов, дни. Жёсткая константа (решение
 * владельца 2026-06-10: «30 дней ставим, никаких саморегулирований»).
 */
export const EXPENSE_RESERVE_HORIZON_DAYS = 30;

/** Тик воркера, порождающего следующие экземпляры повторяющихся расходов. */
const SPAWN_TICK_MS = Number(process.env.EXPENSE_PLAN_SPAWN_INTERVAL_MS) || 6 * 60 * 60 * 1000;

/**
 * Предел догона за один тик на одну серию: защита от бесконечного цикла, если
 * дата почему-то не двигается вперёд. 24 шага покрывают два года простоя для
 * ежемесячного расхода.
 */
const MAX_SPAWN_CATCHUP_STEPS = 24;

/** Сроков в показе серии: срок первой записи и три следующих — год квартальных платежей. */
export const EXPENSE_PLAN_SCHEDULE_PREVIEW_COUNT = 4;

/** Показ серии планового расхода до добавления в реестр. */
export interface ExpensePlanScheduleView {
  /** Сроки платежей: первый и следующие по периодичности; у разового — один. */
  due_dates: Date[];
  /** Сколько месяцев резерв копит один платёж. */
  reserve_months: number;
  /** Сколько резерв откладывает под платёж за месяц, asset-строка; последний месяц добирает остаток. */
  reserve_per_month: string;
}

export interface ExpensePlanView {
  id: number;
  braname: string | null;
  title: string;
  /** Сумма расхода, asset-строка в валюте кооператива. */
  amount: string;
  due_date: Date | null;
  recurrence: ExpensePlanRecurrence;
  /** Срок следующего платежа серии; пусто у разового расхода и записи без срока. */
  next_due_date: Date | null;
  pay_to: string;
  creator: string;
  created_at: Date;
  /** Расход шасси, которым оплачивается запись; пусто — оплата не запускалась. */
  proposal_hash: string | null;
  paid_at: Date | null;
}

/**
 * Общесистемный реестр плановых расходов кооператива (requirement b6).
 *
 * Каждая запись — предстоящая трата: назначение, сумма, срок и реквизиты.
 * Приоритетов нет: всё, что попало в реестр, подлежит оплате. Записи со
 * сроком в ближайшие 30 дней (включая просроченные) образуют резерв, который
 * потребители (распределение членских взносов КУ, закупка впрок) обязаны
 * оставлять нетронутым в общем кошельке участка.
 *
 * Регулярный расход заводится один раз с периодичностью: по наступлении срока
 * система сама добавляет следующий экземпляр серии, а неоплаченный предыдущий
 * остаётся в реестре — долг за прошлый период не исчезает оттого, что подошёл
 * следующий. Лишнее председатель удаляет вручную.
 *
 * Оплата записи выполняется шасси расходов (служебная записка → решение совета
 * → платёж кассиру); ссылка на расход хранится в `proposal_hash`.
 */
@Injectable()
export class ExpensePlansService {
  private readonly logger = new Logger(ExpensePlansService.name);
  /** Гард от наложения тиков воркера повторов (single-instance). */
  private isSpawning = false;

  constructor(
    @Inject(EXPENSES_PLAN_STORE)
    private readonly planRepo: TableStore<ExpensePlanEntity>,
    @Inject(CHAIN_PORT) private readonly blockchainService: IChainPort
  ) {}

  async listPlans(coopname: string, braname?: string | null): Promise<ExpensePlanView[]> {
    const rows = await this.planRepo.find(braname ? { coopname, braname } : { coopname }, { order: { dueDate: 'ASC', id: 'ASC' } });
    return rows.map((r) => this.toView(r));
  }

  /**
   * Реестр глазами того, кто спрашивает. В записях — реквизиты получателей
   * платежей, поэтому целиком реестр видит совет, а операторы участка
   * (председатель и доверенные лица — все, у кого есть доступ к участку) —
   * планы своего участка. Прочим пайщикам реестр закрыт до надобности:
   * до 25.09.2026 он был открыт любому (решение владельца 25.09, C28-80).
   */
  async listPlansFor(coopname: string, viewer: IMonoAccount, braname?: string | null): Promise<ExpensePlanView[]> {
    if (viewer.role === 'chairman' || viewer.role === 'member') return this.listPlans(coopname, braname);
    const own = await this.operatedBranches(coopname, viewer.username);
    if (braname) {
      if (!own.includes(braname)) throw DomainError.forbidden('EXPENSES_PLAN_BRANCH_READ_FORBIDDEN');
      return this.listPlans(coopname, braname);
    }
    if (own.length === 0) throw DomainError.forbidden('EXPENSES_PLAN_BRANCH_READ_FORBIDDEN');
    return (await this.listPlans(coopname)).filter((p) => p.braname !== null && own.includes(p.braname));
  }

  async createPlan(
    coopname: string,
    initiator: string,
    input: {
      braname?: string | null;
      title: string;
      amount: number;
      due_date: Date;
      recurrence?: ExpensePlanRecurrence | null;
      pay_to: string;
    }
  ): Promise<ExpensePlanView> {
    await this.assertCanManage(coopname, initiator, input.braname ?? null);
    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      throw DomainError.badRequest('EXPENSES_PLAN_AMOUNT_NOT_POSITIVE');
    }
    if (!input.due_date) {
      throw DomainError.badRequest('EXPENSES_PLAN_DUE_DATE_REQUIRED');
    }
    const row = await this.planRepo.save(
      this.planRepo.create({
        coopname,
        braname: input.braname ?? null,
        title: input.title.trim(),
        amount: input.amount.toFixed(platformSettings().blockchain.rootGovernPrecision),
        dueDate: input.due_date,
        recurrence: input.recurrence ?? ExpensePlanRecurrence.NONE,
        nextSpawned: false,
        payTo: input.pay_to.trim(),
        creator: initiator,
      })
    );
    return this.toView(row);
  }

  async deletePlan(coopname: string, initiator: string, planId: number): Promise<void> {
    const row = await this.planRepo.findOne({ id: planId, coopname });
    if (!row) {
      throw DomainError.notFound('EXPENSES_PLAN_NOT_FOUND');
    }
    await this.assertCanManage(coopname, initiator, row.braname ?? null);
    await this.planRepo.delete({ id: planId });
  }

  /**
   * Плановый резерв расходов на ближайшие 30 дней, число в валюте
   * кооператива: неоплаченные записи со сроком внутри горизонта, включая
   * просроченные. Скоуп — записи конкретного КУ (braname) либо записи уровня
   * кооператива (braname = null).
   */
  async getReservedAmount(coopname: string, braname: string | null): Promise<number> {
    const plans = await this.listPlans(coopname, braname);
    const horizon = new Date(Date.now() + EXPENSE_RESERVE_HORIZON_DAYS * 24 * 60 * 60 * 1000);
    return plans.reduce((sum, p) => {
      if (p.paid_at) return sum;
      if (!p.due_date || p.due_date > horizon) return sum;
      return sum + this.assetToNumber(p.amount);
    }, 0);
  }

  /**
   * Привязать плановую запись к поданному расходу: пока расход идёт по
   * шасси (решение совета, оплата, отчёт), в реестре видно, что оплата уже
   * запущена, и повторно её не запустить.
   */
  async attachProposal(coopname: string, planId: number, proposalHash: string): Promise<void> {
    const row = await this.planRepo.findOne({ id: planId, coopname });
    if (!row) {
      throw DomainError.notFound('EXPENSES_PLAN_NOT_FOUND');
    }
    if (row.paidAt || (row.proposalHash && row.proposalHash !== proposalHash.toLowerCase())) {
      throw DomainError.badRequest('EXPENSES_PLAN_PAYMENT_ALREADY_STARTED');
    }
    await this.planRepo.update({ id: planId }, { proposalHash: proposalHash.toLowerCase() });
  }

  /**
   * Расход по плановой записи завершился: закрыт — запись считается
   * оплаченной и перестаёт удерживать резерв; отклонён советом — привязка
   * снимается, и оплату можно запустить заново.
   */
  @OnEvent('entitysynced::expense::proposals')
  async handleProposalFinalized(payload: {
    entity: { coopname: string; proposal_hash: string; status: string };
  }): Promise<void> {
    const { coopname, proposal_hash, status } = payload.entity;
    if (status !== ExpenseProposalStatus.CLOSED && status !== ExpenseProposalStatus.DECLINED) return;

    const hash = proposal_hash.toLowerCase();
    const row = await this.planRepo.findOne({ coopname, proposalHash: hash });
    if (!row) return;

    if (status === ExpenseProposalStatus.CLOSED) {
      await this.planRepo.update({ id: row.id }, { paidAt: new Date() });
    } else {
      await this.planRepo.update({ id: row.id }, { proposalHash: null });
    }
  }

  /**
   * Показ серии до добавления: сроки платежей и сколько резерв откладывает под
   * платёж за месяц. Календарь и доля — те же функции каркаса, по которым
   * реестр продолжает серию, а Стол заказов собирает резерв: экран обещает
   * ровно то, что произойдёт. Это показ, запись в реестр не создаётся.
   */
  previewSchedule(input: { amount: number; due_date: Date; recurrence?: ExpensePlanRecurrence | null }): ExpensePlanScheduleView {
    const months = expensePlanRecurrenceMonths(input.recurrence ?? ExpensePlanRecurrence.NONE);
    const { rootGovernPrecision: precision } = platformSettings().blockchain;
    const units = Number.isFinite(input.amount) && input.amount > 0 ? BigInt(Math.round(input.amount * 10 ** precision)) : 0n;
    const reserveMonths = expensePlanReserveMonths(months);
    return {
      due_dates: expensePlanScheduleDates(input.due_date, months, EXPENSE_PLAN_SCHEDULE_PREVIEW_COUNT),
      reserve_months: reserveMonths,
      reserve_per_month: this.unitsToAsset(expensePlanReserveShare(units, reserveMonths - 1, reserveMonths)),
    };
  }

  // ── Повторяющиеся расходы ─────────────────────────────────────────────

  /**
   * Добавляет очередные экземпляры повторяющихся расходов, у которых наступил
   * срок. Предыдущий экземпляр остаётся в реестре как есть — оплачен он или
   * нет; серия просто продолжается дальше по календарю.
   *
   * Догон: если система простаивала дольше периода, за один тик серия
   * доводится до ближайшей будущей даты, а не по одному экземпляру в тик.
   */
  @Interval(SPAWN_TICK_MS)
  async spawnDueRecurrences(): Promise<void> {
    if (this.isSpawning) return;
    this.isSpawning = true;
    try {
      const due = await this.planRepo.find({
          recurrence: notEqual(ExpensePlanRecurrence.NONE),
          nextSpawned: false,
          dueDate: lessOrEqual(new Date()),
        }, { order: { id: 'ASC' } });

      for (const row of due) {
        try {
          await this.spawnSeriesFrom(row);
        } catch (e) {
          // Одна сломанная серия не должна останавливать остальные — реестр
          // плановый, следующий тик повторит попытку.
          this.logger.error(
            `Не удалось продолжить серию планового расхода #${row.id} (${row.title}): ${
              (e as Error).message
            }`
          );
        }
      }
    } finally {
      this.isSpawning = false;
    }
  }

  /** Порождает экземпляры серии, начиная с `head`, пока срок не уйдёт в будущее. */
  private async spawnSeriesFrom(head: ExpensePlanEntity): Promise<void> {
    let current = head;
    const now = new Date();

    for (let step = 0; step < MAX_SPAWN_CATCHUP_STEPS; step++) {
      const currentDue = current.dueDate;
      if (!currentDue) return;

      const nextDue = nextRecurrenceDate(currentDue, current.recurrence);
      if (!nextDue || nextDue <= currentDue) return;

      const next = await this.planRepo.save(
        this.planRepo.create({
          coopname: current.coopname,
          braname: current.braname ?? null,
          title: current.title,
          amount: current.amount,
          dueDate: nextDue,
          recurrence: current.recurrence,
          nextSpawned: false,
          payTo: current.payTo,
          creator: current.creator,
        })
      );
      await this.planRepo.update({ id: current.id }, { nextSpawned: true });

      if (nextDue > now) return;
      current = next;
    }

    this.logger.warn(
      `Серия планового расхода #${head.id} (${head.title}) не догнала текущую дату за ${MAX_SPAWN_CATCHUP_STEPS} шагов`
    );
  }

  // ── Внутреннее ────────────────────────────────────────────────────────

  /**
   * Плановые расходы участка ведёт его оперативный состав — председатель
   * участка и его доверенные лица: это планирование, а не распоряжение
   * деньгами. Отправить расход на оплату (решение совета) вправе только
   * председатель участка — этот guard стоит на стороне подачи расхода.
   *
   * Записи уровня кооператива (без braname) появятся вместе с шасси
   * расходов — до тех пор их создание закрыто.
   */
  private async assertCanManage(
    coopname: string,
    initiator: string,
    braname: string | null
  ): Promise<void> {
    if (!braname) {
      throw DomainError.forbidden('EXPENSES_PLAN_COOP_LEVEL_NOT_SUPPORTED');
    }
    const branch = (await this.branches(coopname)).find((b) => b.braname === braname);
    if (!branch) {
      throw DomainError.notFound('EXPENSES_BRANCH_NOT_FOUND');
    }
    if (!isBranchOperator(branch, initiator)) {
      throw DomainError.forbidden('EXPENSES_PLAN_BRANCH_MANAGE_FORBIDDEN');
    }
  }

  /** Участки, где пайщик — председатель или доверенное лицо. */
  private async operatedBranches(coopname: string, username: string): Promise<string[]> {
    return (await this.branches(coopname)).filter((b) => isBranchOperator(b, username)).map((b) => b.braname);
  }

  private async branches(coopname: string): Promise<BranchContract.Tables.Branches.IBranch[]> {
    return (await this.blockchainService.getAllRows(
      BranchContract.contractName.production,
      coopname,
      BranchContract.Tables.Branches.tableName
    )) as BranchContract.Tables.Branches.IBranch[];
  }

  /** Единицы суммы → asset-строка в валюте кооператива, без потери точности на больших суммах. */
  private unitsToAsset(units: bigint): string {
    const { rootGovernPrecision: precision, rootGovernSymbol: symbol } = platformSettings().blockchain;
    const base = 10n ** BigInt(precision);
    const whole = units / base;
    const fraction = (units % base).toString().padStart(precision, '0');
    return `${whole}${precision > 0 ? `.${fraction}` : ''} ${symbol}`;
  }

  private toView(row: ExpensePlanEntity): ExpensePlanView {
    return {
      id: row.id,
      braname: row.braname ?? null,
      title: row.title,
      amount: `${Number(row.amount).toFixed(platformSettings().blockchain.rootGovernPrecision)} ${
        platformSettings().blockchain.rootGovernSymbol
      }`,
      due_date: row.dueDate ?? null,
      recurrence: row.recurrence ?? ExpensePlanRecurrence.NONE,
      next_due_date: row.dueDate ? nextRecurrenceDate(row.dueDate, row.recurrence ?? ExpensePlanRecurrence.NONE) : null,
      pay_to: row.payTo,
      creator: row.creator,
      created_at: row.createdAt,
      proposal_hash: row.proposalHash ?? null,
      paid_at: row.paidAt ?? null,
    };
  }

  private assetToNumber(asset: string): number {
    return Number(asset.split(' ')[0]);
  }
}
