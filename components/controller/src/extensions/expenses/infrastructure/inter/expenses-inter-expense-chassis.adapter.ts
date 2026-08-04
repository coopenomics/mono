import { Inject, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import type {
  InterExpenseChassisPort,
  InterExpenseItem,
  InterExpensePagination,
  InterExpensePaginatedResult,
  InterExpenseProposalRead,
  InterExpenseProposalStatus,
  InterExpenseRequisiteItemInput,
} from '@coopenomics/inter';
import { PAYMENT_REPOSITORY, PaymentRepository } from '~/domain/gateway/repositories/payment.repository';
import { ExpenseProposalTypeormEntity } from '../entities/expense-proposal.typeorm-entity';
import { ExpenseProposalStatus } from '../../domain/enums/expense-proposal-status.enum';
import { ExpenseReportState } from '../../domain/enums/expense-report-state.enum';
import { ExpenseRequisiteSnapshotsService } from '../../application/services/expense-requisite-snapshots.service';
import {
  EXPENSES_BLOCKCHAIN_PORT,
  ExpensesBlockchainPort,
} from '../../domain/interfaces/expenses-blockchain.port';

/**
 * Реализация `InterExpenseChassisPort` для consumer-расширений (capital, marketplace, EMP)
 * и реестра платежей (gateway).
 *
 * Adapter — тонкий: читает из локального TypeORM-зеркала proposals + items, проектирует
 * во внешний нейтральный DTO `@coopenomics/inter`. Write-методы (`payItem` /
 * `returnItem` / `overspendItem` / `reportItem`) — on-chain действия шасси при
 * подтверждении кассиром платежей расчёта (payexp / returnexp / overspendexp /
 * reportexp), под подписью кооператива.
 */
@Injectable()
export class ExpensesInterExpenseChassisAdapter implements InterExpenseChassisPort {
  constructor(
    @InjectRepository(ExpenseProposalTypeormEntity)
    private readonly repository: Repository<ExpenseProposalTypeormEntity>,
    private readonly requisiteSnapshots: ExpenseRequisiteSnapshotsService,
    @Inject(EXPENSES_BLOCKCHAIN_PORT)
    private readonly chain: ExpensesBlockchainPort,
    @Inject(PAYMENT_REPOSITORY)
    private readonly payments: PaymentRepository,
  ) {}

  async payItem(coopname: string, proposalHash: string, itemHash: string, actualAmount: string): Promise<void> {
    await this.chain.payExp({
      coopname,
      proposal_hash: proposalHash.toLowerCase(),
      item_hash: itemHash.toLowerCase(),
      actual_amount: actualAmount,
    });
  }

  async returnItem(coopname: string, proposalHash: string, itemHash: string, returnAmount: string): Promise<void> {
    await this.chain.returnExp({
      coopname,
      proposal_hash: proposalHash.toLowerCase(),
      item_hash: itemHash.toLowerCase(),
      return_amount: returnAmount,
    });
  }

  async overspendItem(coopname: string, proposalHash: string, itemHash: string, overspendAmount: string): Promise<void> {
    await this.chain.overspendExp({
      coopname,
      proposal_hash: proposalHash.toLowerCase(),
      item_hash: itemHash.toLowerCase(),
      overspend_amount: overspendAmount,
    });
  }

  async reportItem(coopname: string, proposalHash: string, itemHash: string): Promise<void> {
    await this.chain.reportExp({
      coopname,
      proposal_hash: proposalHash.toLowerCase(),
      item_hash: itemHash.toLowerCase(),
    });
    // Зеркалим закрытие отчёта в платёж выдачи аванса (hash платежа = item_hash):
    // реестр платежей показывает «Отчёт принят» сразу после проводки расчёта кассой.
    const payment = await this.payments.findByHash(itemHash.toLowerCase());
    if (payment?.id) {
      await this.payments.update(payment.id, {
        blockchain_data: { ...(payment.blockchain_data ?? {}), report_state: ExpenseReportState.CLOSED },
      });
    }
  }

  async validateRequisites(coopname: string, items: InterExpenseRequisiteItemInput[]): Promise<void> {
    await this.requisiteSnapshots.validate(coopname, items);
  }

  async snapshotRequisites(coopname: string, items: InterExpenseRequisiteItemInput[]): Promise<void> {
    await this.requisiteSnapshots.snapshot(coopname, items);
  }

  async readProposalByHash(coopname: string, proposalHash: string): Promise<InterExpenseProposalRead | null> {
    const entity = await this.repository.findOne({
      where: { coopname, proposal_hash: proposalHash.toLowerCase() },
    });
    return entity ? this.toRead(entity) : null;
  }

  async readProposalsByHashes(coopname: string, proposalHashes: string[]): Promise<InterExpenseProposalRead[]> {
    if (proposalHashes.length === 0) return [];
    const normalized = proposalHashes.map((h) => h.toLowerCase());
    const entities = await this.repository.find({
      where: { coopname, proposal_hash: In(normalized) },
    });
    return entities.map((e) => this.toRead(e));
  }

  async listProposalsByOwner(
    coopname: string,
    ownerContract: string,
    ownerAction?: string,
    pagination?: InterExpensePagination,
  ): Promise<InterExpensePaginatedResult<InterExpenseProposalRead>> {
    const sortBy = pagination?.sortBy === 'createdAt' ? 'expense_proposal.created_at' : 'expense_proposal.updated_at';
    const sortOrder = pagination?.sortOrder === 'ASC' ? 'ASC' : 'DESC';
    const limit = pagination?.limit ?? 50;
    const offset = pagination?.offset ?? 0;

    const qb = this.repository
      .createQueryBuilder('expense_proposal')
      .where('expense_proposal.coopname = :coopname', { coopname })
      .andWhere(`expense_proposal.callback ->> 'contract' = :ownerContract`, { ownerContract });

    if (ownerAction) {
      qb.andWhere(`expense_proposal.callback ->> 'action' = :ownerAction`, { ownerAction });
    }

    const totalCount = await qb.getCount();
    const entities = await qb.orderBy(sortBy, sortOrder).skip(offset).take(limit).getMany();
    return { items: entities.map((e) => this.toRead(e)), totalCount };
  }

  private toRead(e: ExpenseProposalTypeormEntity): InterExpenseProposalRead {
    return {
      coopname: e.coopname,
      proposalHash: e.proposal_hash,
      sourceWalletCode: e.source_wallet ?? '',
      creator: e.username ?? '',
      status: this.mapStatus(e.status),
      callback: e.callback
        ? { contract: e.callback.contract, action: e.callback.action, data: e.callback.data }
        : undefined,
      items: (e.items ?? []).map((it): InterExpenseItem => ({
        itemHash: it.item_hash,
        mechanics: it.mechanics,
        recipientType: it.recipient_type,
        recipient: it.recipient,
        description: it.description,
        plannedAmount: it.planned_amount,
        actualAmount: it.actual_amount,
        status: it.status,
      })),
      totalPlanned: e.total_planned ?? '',
      totalActual: e.total_actual ?? '',
      createdAt: e.created_at?.toISOString?.() ?? '',
      updatedAt: e.updated_at?.toISOString?.() ?? '',
    };
  }

  private mapStatus(status: ExpenseProposalStatus | undefined): InterExpenseProposalStatus {
    switch (status) {
      case ExpenseProposalStatus.CREATED:
        return 'CREATED';
      case ExpenseProposalStatus.AUTHORIZED:
        return 'AUTHORIZED';
      case ExpenseProposalStatus.PARTIALLY_PAID:
        return 'PARTIALLY_PAID';
      case ExpenseProposalStatus.REPORT_SUBMITTED:
        return 'REPORT_SUBMITTED';
      case ExpenseProposalStatus.CLOSED:
        return 'CLOSED';
      case ExpenseProposalStatus.DECLINED:
        return 'DECLINED';
      default:
        return 'UNDEFINED';
    }
  }
}
