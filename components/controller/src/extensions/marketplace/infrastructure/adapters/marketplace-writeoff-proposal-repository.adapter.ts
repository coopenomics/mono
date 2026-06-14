import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import type { PaginationInputDTO } from '~/application/common/dto/pagination.dto';
import { MarketplaceWriteoffProposalDomainEntity } from '../../domain/entities/marketplace-writeoff-proposal.entity';
import {
  MarketplaceWriteoffProposalStatuses,
  type MarketplaceWriteoffProposalDecisionEntry,
  type MarketplaceWriteoffProposalItem,
} from '../../domain/entities/marketplace-writeoff-proposal.types';
import type {
  MarketplaceWriteoffProposalCreateInput,
  MarketplaceWriteoffProposalDomainRepository,
  MarketplaceWriteoffProposalListFilter,
} from '../../domain/repositories/marketplace-writeoff-proposal.repository';
import { MarketplaceWriteoffProposalEntity } from '../entities/marketplace-writeoff-proposal.entity';
import { MarketplaceWriteoffProposalMapper } from '../mappers/marketplace-writeoff-proposal.mapper';

@Injectable()
export class MarketplaceWriteoffProposalRepositoryAdapter
  implements MarketplaceWriteoffProposalDomainRepository
{
  constructor(
    @InjectRepository(MarketplaceWriteoffProposalEntity, 'marketplace')
    private readonly repo: Repository<MarketplaceWriteoffProposalEntity>,
    private readonly mapper: MarketplaceWriteoffProposalMapper
  ) {}

  async create(
    input: MarketplaceWriteoffProposalCreateInput
  ): Promise<MarketplaceWriteoffProposalDomainEntity> {
    const row = this.repo.create({
      coopname: input.coopname,
      trigger: input.trigger,
      status: MarketplaceWriteoffProposalStatuses.DRAFT,
      cycle_started_at: input.cycle_started_at,
      proposal_hash: '',
      decision_id: null,
      proposed_by_account: input.proposed_by_account,
      decided_by_account: null,
      items: input.items,
      total_amount: input.total_amount,
      protocol_doc: null,
      statement_doc: null,
      reject_reason: null,
      decision_log: [
        {
          at: new Date().toISOString(),
          actor: input.proposed_by_account ?? 'system',
          action: 'draft_created',
          payload: { trigger: input.trigger, items_count: input.items.length },
        },
      ],
      submitted_at: null,
      authorized_at: null,
      executed_at: null,
      rejected_at: null,
    });
    const saved = await this.repo.save(row);
    return this.mapper.toDomain(saved);
  }

  async findById(id: string): Promise<MarketplaceWriteoffProposalDomainEntity | null> {
    const row = await this.repo.findOne({ where: { id } });
    return row ? this.mapper.toDomain(row) : null;
  }

  async findByHash(
    coopname: string,
    proposal_hash: string
  ): Promise<MarketplaceWriteoffProposalDomainEntity | null> {
    if (!proposal_hash) return null;
    const row = await this.repo.findOne({ where: { coopname, proposal_hash } });
    return row ? this.mapper.toDomain(row) : null;
  }

  async findOpenDraft(
    coopname: string
  ): Promise<MarketplaceWriteoffProposalDomainEntity | null> {
    const row = await this.repo.findOne({
      where: { coopname, status: MarketplaceWriteoffProposalStatuses.DRAFT },
    });
    return row ? this.mapper.toDomain(row) : null;
  }

  async findOpenInCouncil(
    coopname: string
  ): Promise<MarketplaceWriteoffProposalDomainEntity | null> {
    const row = await this.repo.findOne({
      where: {
        coopname,
        status: In([
          MarketplaceWriteoffProposalStatuses.ON_AGENDA,
          MarketplaceWriteoffProposalStatuses.AUTHORIZED,
          MarketplaceWriteoffProposalStatuses.PENDING_CONFIRMATION,
          MarketplaceWriteoffProposalStatuses.EXECUTING,
        ]),
      },
    });
    return row ? this.mapper.toDomain(row) : null;
  }

  async findActiveLockedInventoryIds(coopname: string): Promise<string[]> {
    // Позиции, уже занятые в незавершённых проектах (черновик, в совете,
    // одобрено, ожидает подтверждения, в исполнении) — нельзя предлагать их
    // в кандидаты повторно, иначе один и тот же товар попадёт в два списания.
    // EXECUTED/REJECTED не блокируют (товар либо списан, либо освобождён).
    const rows = await this.repo.find({
      where: {
        coopname,
        status: In([
          MarketplaceWriteoffProposalStatuses.DRAFT,
          MarketplaceWriteoffProposalStatuses.ON_AGENDA,
          MarketplaceWriteoffProposalStatuses.AUTHORIZED,
          MarketplaceWriteoffProposalStatuses.PENDING_CONFIRMATION,
          MarketplaceWriteoffProposalStatuses.EXECUTING,
        ]),
      },
      select: { items: true } as never,
    });
    const ids = new Set<string>();
    for (const row of rows) {
      for (const item of row.items ?? []) {
        for (const id of item.inventory_ids ?? []) ids.add(id);
      }
    }
    return [...ids];
  }

  async list(
    filter: MarketplaceWriteoffProposalListFilter,
    pagination?: PaginationInputDTO
  ): Promise<{ items: MarketplaceWriteoffProposalDomainEntity[]; total: number }> {
    const qb = this.repo
      .createQueryBuilder('p')
      .where('p.coopname = :coopname', { coopname: filter.coopname });
    if (filter.statuses && filter.statuses.length > 0) {
      qb.andWhere('p.status IN (:...statuses)', { statuses: filter.statuses });
    }
    const page = pagination?.page ?? 1;
    const limit = pagination?.limit ?? 50;
    const skip = (page - 1) * limit;
    qb.orderBy('p.created_at', 'DESC').skip(skip).take(limit);
    const [rows, total] = await qb.getManyAndCount();
    return { items: rows.map((r) => this.mapper.toDomain(r)), total };
  }

  async updateDraftItems(
    id: string,
    items: MarketplaceWriteoffProposalItem[],
    total_amount: string,
    log: MarketplaceWriteoffProposalDecisionEntry
  ): Promise<MarketplaceWriteoffProposalDomainEntity> {
    const row = await this.repo.findOneOrFail({ where: { id } });
    if (row.status !== MarketplaceWriteoffProposalStatuses.DRAFT) {
      throw new Error('Редактировать можно только проект в статусе DRAFT');
    }
    row.items = items;
    row.total_amount = total_amount;
    row.decision_log = [...(row.decision_log ?? []), log];
    const saved = await this.repo.save(row);
    return this.mapper.toDomain(saved);
  }

  async submitToCouncil(
    id: string,
    patch: {
      proposal_hash: string;
      statement_doc: unknown;
      decision_id: number | null;
      submitted_at: Date;
      proposed_by_account: string;
      log: MarketplaceWriteoffProposalDecisionEntry;
    }
  ): Promise<MarketplaceWriteoffProposalDomainEntity> {
    const row = await this.repo.findOneOrFail({ where: { id } });
    if (row.status !== MarketplaceWriteoffProposalStatuses.DRAFT) {
      throw new Error('Передать в совет можно только проект в статусе DRAFT');
    }
    row.status = MarketplaceWriteoffProposalStatuses.ON_AGENDA;
    row.proposal_hash = patch.proposal_hash;
    row.statement_doc = patch.statement_doc;
    row.decision_id = patch.decision_id !== null ? String(patch.decision_id) : null;
    row.submitted_at = patch.submitted_at;
    row.proposed_by_account = patch.proposed_by_account;
    row.decision_log = [...(row.decision_log ?? []), patch.log];
    const saved = await this.repo.save(row);
    return this.mapper.toDomain(saved);
  }

  async markAuthorized(
    id: string,
    patch: {
      protocol_doc: unknown;
      authorized_at: Date;
      decided_by_account: string | null;
      log: MarketplaceWriteoffProposalDecisionEntry;
    }
  ): Promise<MarketplaceWriteoffProposalDomainEntity> {
    const row = await this.repo.findOneOrFail({ where: { id } });
    if (row.status !== MarketplaceWriteoffProposalStatuses.ON_AGENDA) {
      throw new Error('Авторизовать можно только проект, отправленный в совет (ON_AGENDA)');
    }
    // Совет одобрил → ждём подтверждения складов председателями КУ. На цепи
    // wroffprops.status = authorized; в PG — PENDING_CONFIRMATION.
    row.status = MarketplaceWriteoffProposalStatuses.PENDING_CONFIRMATION;
    row.protocol_doc = patch.protocol_doc;
    row.authorized_at = patch.authorized_at;
    row.decided_by_account = patch.decided_by_account;
    row.decision_log = [...(row.decision_log ?? []), patch.log];
    const saved = await this.repo.save(row);
    return this.mapper.toDomain(saved);
  }

  async markExecuting(
    id: string,
    log: MarketplaceWriteoffProposalDecisionEntry
  ): Promise<MarketplaceWriteoffProposalDomainEntity> {
    const row = await this.repo.findOneOrFail({ where: { id } });
    if (row.status !== MarketplaceWriteoffProposalStatuses.AUTHORIZED) {
      throw new Error('Запустить исполнение можно только из статуса AUTHORIZED');
    }
    row.status = MarketplaceWriteoffProposalStatuses.EXECUTING;
    row.decision_log = [...(row.decision_log ?? []), log];
    const saved = await this.repo.save(row);
    return this.mapper.toDomain(saved);
  }

  async markItemExecuted(
    id: string,
    item_index: number,
    log: MarketplaceWriteoffProposalDecisionEntry
  ): Promise<MarketplaceWriteoffProposalDomainEntity> {
    const row = await this.repo.findOneOrFail({ where: { id } });
    if (item_index < 0 || item_index >= row.items.length) {
      throw new Error('Указана несуществующая позиция в проекте списания');
    }
    const items = row.items.map((it, idx) =>
      idx === item_index ? { ...it, executed: true } : it
    );
    row.items = items;
    row.decision_log = [...(row.decision_log ?? []), log];
    const saved = await this.repo.save(row);
    return this.mapper.toDomain(saved);
  }

  async markFullyExecuted(
    id: string,
    log: MarketplaceWriteoffProposalDecisionEntry
  ): Promise<MarketplaceWriteoffProposalDomainEntity> {
    const row = await this.repo.findOneOrFail({ where: { id } });
    row.status = MarketplaceWriteoffProposalStatuses.EXECUTED;
    row.executed_at = new Date();
    row.decision_log = [...(row.decision_log ?? []), log];
    const saved = await this.repo.save(row);
    return this.mapper.toDomain(saved);
  }

  async markRejected(
    id: string,
    patch: {
      reject_reason: string;
      rejected_at: Date;
      decided_by_account: string | null;
      log: MarketplaceWriteoffProposalDecisionEntry;
    }
  ): Promise<MarketplaceWriteoffProposalDomainEntity> {
    const row = await this.repo.findOneOrFail({ where: { id } });
    row.status = MarketplaceWriteoffProposalStatuses.REJECTED;
    row.reject_reason = patch.reject_reason;
    row.rejected_at = patch.rejected_at;
    row.decided_by_account = patch.decided_by_account;
    row.decision_log = [...(row.decision_log ?? []), patch.log];
    const saved = await this.repo.save(row);
    return this.mapper.toDomain(saved);
  }

  async cancelDraft(id: string): Promise<void> {
    const row = await this.repo.findOne({ where: { id } });
    if (!row) throw new NotFoundException('Проект списания не найден');
    if (row.status !== MarketplaceWriteoffProposalStatuses.DRAFT) {
      throw new Error('Удалить можно только проект в статусе DRAFT');
    }
    await this.repo.delete({ id });
  }
}
