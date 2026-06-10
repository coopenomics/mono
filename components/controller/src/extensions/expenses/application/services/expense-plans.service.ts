import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { BranchContract } from 'cooptypes';
import config from '~/config/config';
import { BlockchainService } from '~/infrastructure/blockchain/blockchain.service';
import { ExpensePlanEntity } from '../../infrastructure/entities/expense-plan.entity';
import { ExpensePlanPriority } from '../../domain/expense-plan.types';

export const EXPENSE_PLANS_SERVICE = Symbol('EXPENSE_PLANS_SERVICE');

/**
 * Горизонт планового резерва расходов, дни. Жёсткая константа (решение
 * владельца 2026-06-10: «30 дней ставим, никаких саморегулирований»).
 */
export const EXPENSE_RESERVE_HORIZON_DAYS = 30;

export interface ExpensePlanView {
  id: number;
  braname: string | null;
  title: string;
  /** Сумма расхода, asset-строка в валюте кооператива. */
  amount: string;
  due_date: Date | null;
  priority: ExpensePlanPriority;
  pay_to: string;
  creator: string;
  created_at: Date;
}

/**
 * Общесистемный реестр плановых расходов кооператива (requirement b6,
 * раунд 5). Плановая информация — оффчейн (контракт шасси расходов
 * существует, но не включён); этот сервис — основа плановых расчётов:
 * считает 30-дневный резерв, который потребители (распределение членских
 * взносов КУ, закупка впрок) обязаны оставлять нетронутым в общем кошельке
 * участка. При включении шасси расходов план-записи совместятся с его
 * процессами.
 */
@Injectable()
export class ExpensePlansService {
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
      due_date?: Date | null;
      priority: ExpensePlanPriority;
      pay_to: string;
    }
  ): Promise<ExpensePlanView> {
    await this.assertCanManage(coopname, initiator, input.braname ?? null);
    if (!Number.isFinite(input.amount) || input.amount <= 0) {
      throw new BadRequestException('Сумма планового расхода должна быть больше нуля');
    }
    if (input.priority === ExpensePlanPriority.SCHEDULED && !input.due_date) {
      throw new BadRequestException('Для расхода с оплатой к дате укажите срок оплаты');
    }
    const row = await this.planRepo.save(
      this.planRepo.create({
        coopname,
        braname: input.braname ?? null,
        title: input.title.trim(),
        amount: input.amount.toFixed(config.blockchain.root_govern_precision),
        dueDate: input.priority === ExpensePlanPriority.SCHEDULED ? input.due_date : null,
        priority: input.priority,
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
   * кооператива: все срочные (URGENT) + расходы к дате (SCHEDULED) со
   * сроком внутри горизонта, включая просроченные. Необязательные
   * (OPTIONAL) в резерв не входят. Скоуп — записи конкретного КУ
   * (braname) либо записи уровня кооператива (braname = null).
   */
  async getReservedAmount(coopname: string, braname: string | null): Promise<number> {
    const plans = await this.listPlans(coopname, braname);
    const horizon = new Date(Date.now() + EXPENSE_RESERVE_HORIZON_DAYS * 24 * 60 * 60 * 1000);
    return plans.reduce((sum, p) => {
      if (p.priority === ExpensePlanPriority.URGENT) {
        return sum + this.assetToNumber(p.amount);
      }
      if (p.priority === ExpensePlanPriority.SCHEDULED && p.due_date && p.due_date <= horizon) {
        return sum + this.assetToNumber(p.amount);
      }
      return sum;
    }, 0);
  }

  // ── Внутреннее ────────────────────────────────────────────────────────

  /**
   * Планы КУ ведёт председатель этого участка (trustee в branch::branches).
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
    if (branch.trustee !== initiator) {
      throw new ForbiddenException(
        'Плановые расходы участка ведёт только председатель этого кооперативного участка'
      );
    }
  }

  private toView(row: ExpensePlanEntity): ExpensePlanView {
    return {
      id: row.id,
      braname: row.braname ?? null,
      title: row.title,
      amount: `${Number(row.amount).toFixed(config.blockchain.root_govern_precision)} ${
        config.blockchain.root_govern_symbol
      }`,
      due_date: row.dueDate ?? null,
      priority: row.priority,
      pay_to: row.payTo,
      creator: row.creator,
      created_at: row.createdAt,
    };
  }

  private assetToNumber(asset: string): number {
    return Number(asset.split(' ')[0]);
  }
}
