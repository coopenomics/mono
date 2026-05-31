import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { MarketplaceOrderDomainEntity } from '../../domain/entities/marketplace-order.entity';
import type {
  MarketplaceOrderCreateInput,
  MarketplaceOrderDomainRepository,
  MarketplaceOrderListFilter,
} from '../../domain/repositories/marketplace-order.repository';
import type {
  MarketplaceOrderIssuanceFactSnapshot,
  MarketplaceOrderStatus,
} from '../../domain/entities/marketplace-order.types';
import type {
  PaginationInputDomainInterface,
  PaginationResultDomainInterface,
} from '~/domain/common/interfaces/pagination.interface';
import { MarketplaceOrderEntity } from '../entities/marketplace-order.entity';
import { MarketplaceOrderMapper } from '../mappers/marketplace-order.mapper';
import type { ISignedDocumentDomainInterface } from '~/domain/document/interfaces/signed-document-domain.interface';

@Injectable()
export class MarketplaceOrderRepositoryAdapter implements MarketplaceOrderDomainRepository {
  constructor(
    @InjectRepository(MarketplaceOrderEntity, 'marketplace')
    private readonly repo: Repository<MarketplaceOrderEntity>,
    private readonly mapper: MarketplaceOrderMapper
  ) {}

  async persistAfterBlock(input: MarketplaceOrderCreateInput): Promise<MarketplaceOrderDomainEntity> {
    const row = this.repo.create({
      coopname: input.coopname,
      order_hash: input.order_hash.toLowerCase(),
      orderer_account: input.orderer_account,
      offer_id: input.offer_id,
      offer_hash: input.offer_hash.toLowerCase(),
      supplier_account: input.supplier_account,
      delivery_braname: input.delivery_braname,
      quantity: input.quantity,
      price_per_unit: input.price_per_unit,
      total_cost: input.total_cost,
      cycle_id: input.cycle_id,
      warranty_period_secs: input.warranty_period_secs,
      warranty_until: input.warranty_until,
      status: input.status,
      last_status_reason: null,
      blocked_at: input.blocked_at,
      accepted_at: null,
      received_at: null,
      cancelled_at: null,
      create_tx: input.create_tx,
      on_chain_id: null,
      on_chain_block_num: null,
      on_chain_present: false,
    });
    const saved = await this.repo.save(row);
    return this.mapper.toDomain(saved);
  }

  async findById(id: string): Promise<MarketplaceOrderDomainEntity | null> {
    const row = await this.repo.findOne({ where: { id } });
    return row ? this.mapper.toDomain(row) : null;
  }

  async findByIds(ids: string[]): Promise<MarketplaceOrderDomainEntity[]> {
    if (ids.length === 0) return [];
    const rows = await this.repo.find({ where: { id: In(ids) } });
    return rows.map((row) => this.mapper.toDomain(row));
  }

  async findByOrderHash(
    coopname: string,
    order_hash: string
  ): Promise<MarketplaceOrderDomainEntity | null> {
    const row = await this.repo.findOne({
      where: { coopname, order_hash: order_hash.toLowerCase() },
    });
    return row ? this.mapper.toDomain(row) : null;
  }

  async list(
    filter: MarketplaceOrderListFilter,
    pagination: PaginationInputDomainInterface
  ): Promise<PaginationResultDomainInterface<MarketplaceOrderDomainEntity>> {
    const qb = this.repo.createQueryBuilder('o').where('o.coopname = :coop', { coop: filter.coopname });

    if (filter.orderer_account) qb.andWhere('o.orderer_account = :ord', { ord: filter.orderer_account });
    if (filter.supplier_account) qb.andWhere('o.supplier_account = :sup', { sup: filter.supplier_account });
    if (filter.offer_id) qb.andWhere('o.offer_id = :off', { off: filter.offer_id });
    if (filter.cycle_id) qb.andWhere('o.cycle_id = :cid', { cid: filter.cycle_id });
    if (filter.delivery_braname) qb.andWhere('o.delivery_braname = :br', { br: filter.delivery_braname });
    if (filter.status) {
      const statuses = Array.isArray(filter.status) ? filter.status : [filter.status];
      qb.andWhere('o.status IN (:...statuses)', { statuses });
    }

    qb.orderBy('o.updated_at', pagination.sortOrder ?? 'DESC');
    qb.skip((pagination.page - 1) * pagination.limit).take(pagination.limit);

    const [rows, totalCount] = await qb.getManyAndCount();
    return {
      items: rows.map((r) => this.mapper.toDomain(r)),
      totalCount,
      totalPages: Math.ceil(totalCount / pagination.limit),
      currentPage: pagination.page,
    };
  }

  async applyStatusTransition(
    id: string,
    newStatus: MarketplaceOrderStatus,
    reason: string | null
  ): Promise<MarketplaceOrderDomainEntity> {
    const patch: Partial<MarketplaceOrderEntity> = {
      status: newStatus,
      last_status_reason: reason,
    };
    if (newStatus === 'ACCEPTED') patch.accepted_at = new Date();
    else if (newStatus === 'RECEIVED') patch.received_at = new Date();
    else if (
      newStatus === 'CANCELLED_BY_ORDERER' ||
      newStatus === 'CANCELLED_BY_SUPPLIER'
    ) {
      patch.cancelled_at = new Date();
    }

    await this.repo.update({ id }, patch as Record<string, unknown>);
    const row = await this.repo.findOneOrFail({ where: { id } });
    return this.mapper.toDomain(row);
  }

  // ── IBlockchainSyncRepository (для syncer'а) ──────────────────────

  async findBySyncKey(
    syncKey: string,
    syncValue: string
  ): Promise<MarketplaceOrderDomainEntity | null> {
    if (syncKey !== 'order_hash') {
      throw new Error(
        `MarketplaceOrderRepositoryAdapter.findBySyncKey: ожидался order_hash, получено "${syncKey}"`
      );
    }
    const row = await this.repo.findOne({ where: { order_hash: syncValue.toLowerCase() } });
    return row ? this.mapper.toDomain(row) : null;
  }

  async findByBlockNumGreaterThan(blockNum: number): Promise<MarketplaceOrderDomainEntity[]> {
    const rows = await this.repo
      .createQueryBuilder('o')
      .where('o.on_chain_block_num > :bn', { bn: blockNum })
      .getMany();
    return rows.map((r) => this.mapper.toDomain(r));
  }

  async create(_entity: MarketplaceOrderDomainEntity): Promise<unknown> {
    throw new Error(
      'MarketplaceOrderRepositoryAdapter.create(entity): не используется в Story 4.1 — используйте persistAfterBlock(input).'
    );
  }

  async saveCreated(entity: MarketplaceOrderEntity): Promise<MarketplaceOrderDomainEntity> {
    const saved = await this.repo.save(entity);
    return this.mapper.toDomain(saved);
  }

  async save(entity: MarketplaceOrderDomainEntity): Promise<MarketplaceOrderDomainEntity> {
    return this.persistDomain(entity);
  }

  async update(entity: MarketplaceOrderDomainEntity): Promise<MarketplaceOrderDomainEntity> {
    return this.persistDomain(entity);
  }

  /**
   * Story 4.1 syncer-flow: если on-chain row пришёл первым (Order
   * создан полностью на цепи без участия backend create-flow — например,
   * через CLI), создаём PG row из blockchain-данных как заглушку.
   * Остальные поля заполнятся при попытке backend create-flow
   * (idempotency через unique `(coopname, order_hash)`).
   *
   * НО: в нашем create-flow Story 4.1 backend ВСЕГДА создаёт PG row до
   * submit (transactional intent), так что этот путь — фолбэк для
   * out-of-band on-chain транзакций. По умолчанию — no-op с warn-логом.
   */
  async createIfNotExists(
    blockchainData: { order_hash: string; on_chain_id: string; status: MarketplaceOrderStatus },
    blockNum: number,
    present = true
  ): Promise<MarketplaceOrderDomainEntity> {
    const existing = await this.findBySyncKey('order_hash', blockchainData.order_hash);
    if (existing) {
      existing.on_chain_id = blockchainData.on_chain_id;
      existing.on_chain_block_num = blockNum;
      existing.on_chain_present = present;
      existing.status = blockchainData.status;
      return this.persistDomain(existing);
    }
    // Out-of-band on-chain Order: оставляем минимальный stub-row,
    // backend create-flow дополнит остальные поля по unique-conflict.
    throw new Error(
      `MarketplaceOrderRepositoryAdapter.createIfNotExists: out-of-band on-chain Order без backend create-flow (order_hash=${blockchainData.order_hash}); фолбэк не реализован в Story 4.1 — заведите Order через marketplaceCreateOrder mutation.`
    );
  }

  // ── Story 4.2: cycle-aggregation queries ──────────────────────────

  async findUnassignedActiveByOffer(
    coopname: string,
    offer_id: string
  ): Promise<MarketplaceOrderDomainEntity[]> {
    const rows = await this.repo
      .createQueryBuilder('o')
      .where('o.coopname = :coop AND o.offer_id = :off AND o.status = :st AND o.cycle_id IS NULL', {
        coop: coopname,
        off: offer_id,
        st: 'ACTIVE',
      })
      .orderBy('o.blocked_at', 'ASC')
      .getMany();
    return rows.map((r) => this.mapper.toDomain(r));
  }

  async assignToCycle(
    orderIds: string[],
    cycle_id: string,
    newStatus: MarketplaceOrderStatus
  ): Promise<number> {
    if (orderIds.length === 0) return 0;
    const result = await this.repo
      .createQueryBuilder()
      .update(MarketplaceOrderEntity)
      .set({
        cycle_id,
        status: newStatus,
        accepted_at: newStatus === 'ACCEPTED' ? new Date() : undefined,
      })
      .where('id IN (:...ids) AND cycle_id IS NULL', { ids: orderIds })
      .execute();
    return result.affected ?? 0;
  }

  async findByCycleId(
    coopname: string,
    cycle_id: string
  ): Promise<MarketplaceOrderDomainEntity[]> {
    const rows = await this.repo
      .createQueryBuilder('o')
      .where('o.coopname = :coop AND o.cycle_id = :cid', { coop: coopname, cid: cycle_id })
      .orderBy('o.blocked_at', 'ASC')
      .getMany();
    return rows.map((r) => this.mapper.toDomain(r));
  }

  async findByShipmentId(
    coopname: string,
    shipment_id: string
  ): Promise<MarketplaceOrderDomainEntity[]> {
    const rows = await this.repo
      .createQueryBuilder('o')
      .where('o.coopname = :coop AND o.shipment_id = :sid', { coop: coopname, sid: shipment_id })
      .orderBy('o.blocked_at', 'ASC')
      .getMany();
    return rows.map((r) => this.mapper.toDomain(r));
  }

  async assignToShipment(
    orderIds: string[],
    shipment_id: string,
    reason: string | null
  ): Promise<number> {
    if (orderIds.length === 0) return 0;
    const result = await this.repo
      .createQueryBuilder()
      .update(MarketplaceOrderEntity)
      .set({ shipment_id, status: 'SUPPLY_PREPARED', last_status_reason: reason })
      .where('id IN (:...ids) AND status = :accepted AND shipment_id IS NULL', {
        ids: orderIds,
        accepted: 'ACCEPTED',
      })
      .execute();
    return result.affected ?? 0;
  }

  async sumUnassignedActiveByOffer(coopname: string, offer_id: string): Promise<number> {
    const raw = await this.repo
      .createQueryBuilder('o')
      .select('COALESCE(SUM(o.quantity), 0)', 'total')
      .where('o.coopname = :coop AND o.offer_id = :off AND o.status = :st AND o.cycle_id IS NULL', {
        coop: coopname,
        off: offer_id,
        st: 'ACTIVE',
      })
      .getRawOne<{ total: string }>();
    return Number(raw?.total ?? 0);
  }

  async deleteByBlockNumGreaterThan(blockNum: number): Promise<void> {
    await this.repo
      .createQueryBuilder()
      .delete()
      .where('on_chain_block_num > :bn', { bn: blockNum })
      .execute();
  }

  // ── Story 6.1 / 6.3: выдача пайщику ──────────────────────────────

  async applyIssuanceOpened(
    id: string,
    patch: {
      chairman_account: string;
      signiss1_tx_hash: string;
      current_warehouse_braname: string;
      issuance_fact: MarketplaceOrderIssuanceFactSnapshot;
      issue_act_signiss1_document: ISignedDocumentDomainInterface;
    }
  ): Promise<MarketplaceOrderDomainEntity> {
    await this.repo.update(
      { id },
      {
        status: 'READY_TO_RECEIVE',
        chairman_signed_at: new Date(),
        chairman_account: patch.chairman_account,
        signiss1_tx_hash: patch.signiss1_tx_hash,
        current_warehouse_braname: patch.current_warehouse_braname,
        issuance_fact: patch.issuance_fact,
        issue_act_signiss1_document: patch.issue_act_signiss1_document,
      } as Record<string, unknown>
    );
    const row = await this.repo.findOneOrFail({ where: { id } });
    return this.mapper.toDomain(row);
  }

  async applyIssuanceFinalized(
    id: string,
    patch: {
      delivery_signer_account: string;
      signiss2_tx_hash: string;
      issuance_fact: MarketplaceOrderIssuanceFactSnapshot;
      warranty_until: Date | null;
    }
  ): Promise<MarketplaceOrderDomainEntity> {
    await this.repo.update(
      { id },
      {
        status: 'RECEIVED',
        received_at: new Date(),
        orderer_signed_at: new Date(),
        delivery_signer_account: patch.delivery_signer_account,
        signiss2_tx_hash: patch.signiss2_tx_hash,
        issuance_fact: patch.issuance_fact,
        warranty_until: patch.warranty_until,
      } as Record<string, unknown>
    );
    const row = await this.repo.findOneOrFail({ where: { id } });
    return this.mapper.toDomain(row);
  }

  async listForIssuanceByBraname(
    coopname: string,
    delivery_braname: string
  ): Promise<MarketplaceOrderDomainEntity[]> {
    const rows = await this.repo
      .createQueryBuilder('o')
      .where('o.coopname = :coop AND o.delivery_braname = :br AND o.status IN (:...sts)', {
        coop: coopname,
        br: delivery_braname,
        sts: ['ACCEPTED_TO_COOP', 'READY_TO_RECEIVE'],
      })
      .orderBy('o.accepted_at', 'ASC')
      .getMany();
    return rows.map((r) => this.mapper.toDomain(r));
  }

  async listReadyToReceiveByOrderer(
    coopname: string,
    orderer_account: string
  ): Promise<MarketplaceOrderDomainEntity[]> {
    const rows = await this.repo
      .createQueryBuilder('o')
      .where('o.coopname = :coop AND o.orderer_account = :u AND o.status = :st', {
        coop: coopname,
        u: orderer_account,
        st: 'READY_TO_RECEIVE',
      })
      .orderBy('o.accepted_at', 'ASC')
      .getMany();
    return rows.map((r) => this.mapper.toDomain(r));
  }

  // ── private ──

  private async persistDomain(
    entity: MarketplaceOrderDomainEntity
  ): Promise<MarketplaceOrderDomainEntity> {
    await this.repo.update(
      { id: entity.id },
      {
        status: entity.status,
        last_status_reason: entity.last_status_reason,
        accepted_at: entity.accepted_at,
        received_at: entity.received_at,
        cancelled_at: entity.cancelled_at,
        on_chain_id: entity.on_chain_id,
        on_chain_block_num: entity.on_chain_block_num,
        on_chain_present: entity.on_chain_present,
      }
    );
    const row = await this.repo.findOneOrFail({ where: { id: entity.id } });
    return this.mapper.toDomain(row);
  }
}
