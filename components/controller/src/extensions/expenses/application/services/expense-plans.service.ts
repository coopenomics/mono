import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { OnEvent } from '@nestjs/event-emitter';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThanOrEqual, Not, Repository } from 'typeorm';
import { BranchContract } from 'cooptypes';
import { platformSettings } from '@coopenomics/extension-kit';
import { BlockchainService } from '~/infrastructure/blockchain/blockchain.service';
import { ExpensePlanEntity } from '../../infrastructure/entities/expense-plan.entity';
import { ExpensePlanRecurrence, nextRecurrenceDate } from '../../domain/expense-plan.types';
import { ExpenseProposalStatus } from '../../domain/enums/expense-proposal-status.enum';

export const EXPENSE_PLANS_SERVICE = Symbol('EXPENSE_PLANS_SERVICE');

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

export interface ExpensePlanView {
  id: number;
  braname: string | null;
  title: string;
  /** Сумма расхода, asset-строка в валюте кооператива. */
  amount: string;
  due_date: Date | null;
  recurrence: ExpensePlanRecurrence;
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
    @InjectRepository(ExpensePlanEntity)
    private readonly planRepo: Repository<ExpensePlanEntity>,
    private readonly blockchainService: BlockchainService
  ) {}

  async listPlans(coopname: string, braname?: string | null): Promise<ExpensePlanView[]> {
    const rows = await this.planRepo.find({
      where: braname ? { coopname, braname } : { coopname },
      order: { dueDate: 'ASC', id: 'ASC' },
    });
    return rows.map((r) => this.toView(r));
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
      throw new BadRequestException('Сумма планового расхода должна быть больше нуля');
    }
    if (!input.due_date) {
      throw new BadRequestException('Укажите дату, к которой расход должен быть оплачен');
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
    const row = await this.planRepo.findOne({ where: { id: planId, coopname } });
    if (!row) {
      throw new NotFoundException('Плановый расход не найден');
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
    const row = await this.planRepo.findOne({ where: { id: planId, coopname } });
    if (!row) {
      throw new NotFoundException('Плановый расход не найден');
    }
    if (row.proposalHash && row.proposalHash !== proposalHash.toLowerCase()) {
      throw new BadRequestException('По этому плановому расходу оплата уже запущена');
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
    const row = await this.planRepo.findOne({ where: { coopname, proposalHash: hash } });
    if (!row) return;

    if (status === ExpenseProposalStatus.CLOSED) {
      await this.planRepo.update({ id: row.id }, { paidAt: new Date() });
    } else {
      await this.planRepo.update({ id: row.id }, { proposalHash: null });
    }
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
        where: {
          recurrence: Not(ExpensePlanRecurrence.NONE),
          nextSpawned: false,
          dueDate: LessThanOrEqual(new Date()),
        },
        order: { id: 'ASC' },
      });

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
      throw new ForbiddenException(
        'Плановые расходы уровня кооператива появятся вместе с общесистемным учётом расходов'
      );
    }
    const branches = (await this.blockchainService.getAllRows(
      BranchContract.contractName.production,
      coopname,
      BranchContract.Tables.Branches.tableName
    )) as BranchContract.Tables.Branches.IBranch[];
    const branch = branches.find((b) => b.braname === braname);
    if (!branch) {
      throw new NotFoundException('Кооперативный участок не найден');
    }
    const isOperator = branch.trustee === initiator || branch.trusted.includes(initiator);
    if (!isOperator) {
      throw new ForbiddenException(
        'Плановые расходы участка ведут председатель участка и его доверенные лица'
      );
    }
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
