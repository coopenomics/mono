import type {
  MarketplaceOrderCreateTxSnapshot,
  MarketplaceOrderCycleType,
  MarketplaceOrderIssuanceFactSnapshot,
  MarketplaceOrderProps,
  MarketplaceOrderStatus,
} from './marketplace-order.types';
import type { IBlockchainSynchronizable } from '~/shared/interfaces/blockchain-sync.interface';

/**
 * Story 4.1: домен Order'а Стола заказов. Backend-only представление
 * marketplace_order ↔ on-chain `marketplace::orders` row (Story 11.1).
 *
 * Sync-key — `order_hash` (checksum256 из C++; backend хранит как hex string
 * без `0x` префикса, lowercase — нормализация в delta-mapper / конструкторе).
 *
 * Primary-key в PG — `id` (UUID), отделён от sync-key (ADR-001 FR8).
 *
 * `on_chain_*` поля идут как nullable snapshot последней delta'и из
 * парсера: пока row физически не материализована — null. Read-path
 * Эпика 4 (Story 4.6 «Мои заказы») читает только PG, без RPC fallback
 * (ADR-011); pending-state передаётся наверх как есть.
 *
 * Класс реализует `IBlockchainSynchronizable` — точка интеграции с
 * `AbstractEntitySyncService` (см. `marketplace-order-sync.service.ts`).
 */
export class MarketplaceOrderDomainEntity implements IBlockchainSynchronizable {
  public readonly id: string;
  public readonly coopname: string;
  public readonly order_hash: string;
  public readonly orderer_account: string;
  public readonly offer_id: string;
  public readonly offer_hash: string;
  public readonly supplier_account: string;
  public readonly delivery_braname: string;
  public readonly quantity: number;
  public readonly price_per_unit: string;
  public readonly total_cost: string;
  public readonly cycle_type: MarketplaceOrderCycleType;
  public readonly cycle_id: string | null;
  public readonly warranty_period_secs: number;
  public readonly warranty_until: Date | null;
  public status: MarketplaceOrderStatus;
  public last_status_reason: string | null;
  public readonly blocked_at: Date | null;
  public accepted_at: Date | null;
  public received_at: Date | null;
  public cancelled_at: Date | null;
  public create_tx: MarketplaceOrderCreateTxSnapshot | null;
  /**
   * Story 6.1 / FR21: ПВЗ, на котором имущество фактически лежит к моменту
   * выдачи. На `signiss1` приравнивается `delivery_braname` (фиксация
   * логистической передачи на склад выдачи) — промежуточные перемещения
   * по заготовочным КУ контрактом не подписываются, точка хранения
   * переходит «скачком».
   */
  public current_warehouse_braname: string | null;
  /** Story 6.3 / FR23-24: снапшот фактической выдачи после `signiss2`. */
  public issuance_fact: MarketplaceOrderIssuanceFactSnapshot | null;
  /** Story 6.1 / FR21: момент открытия выдачи председателем КУ (`signiss1`). */
  public chairman_signed_at: Date | null;
  public chairman_account: string | null;
  public signiss1_tx_hash: string | null;
  /** Story 6.3 / FR24: момент финальной подписи заказчика (`signiss2`). */
  public orderer_signed_at: Date | null;
  public delivery_signer_account: string | null;
  public signiss2_tx_hash: string | null;
  public on_chain_id: string | null;
  public on_chain_block_num: number | null;
  public on_chain_present: boolean;
  public readonly created_at: Date;
  public updated_at: Date;

  constructor(props: MarketplaceOrderProps) {
    if (!props.order_hash || props.order_hash.length !== 64) {
      throw new Error(
        `MarketplaceOrderDomainEntity: order_hash должен быть 64-символьным hex (получено: "${props.order_hash}")`
      );
    }
    this.id = props.id;
    this.coopname = props.coopname;
    this.order_hash = props.order_hash.toLowerCase();
    this.orderer_account = props.orderer_account;
    this.offer_id = props.offer_id;
    this.offer_hash = props.offer_hash.toLowerCase();
    this.supplier_account = props.supplier_account;
    this.delivery_braname = props.delivery_braname;
    this.quantity = props.quantity;
    this.price_per_unit = props.price_per_unit;
    this.total_cost = props.total_cost;
    this.cycle_type = props.cycle_type;
    this.cycle_id = props.cycle_id;
    this.warranty_period_secs = props.warranty_period_secs;
    this.warranty_until = props.warranty_until;
    this.status = props.status;
    this.last_status_reason = props.last_status_reason;
    this.blocked_at = props.blocked_at;
    this.accepted_at = props.accepted_at;
    this.received_at = props.received_at;
    this.cancelled_at = props.cancelled_at;
    this.create_tx = props.create_tx;
    this.current_warehouse_braname = props.current_warehouse_braname;
    this.issuance_fact = props.issuance_fact;
    this.chairman_signed_at = props.chairman_signed_at;
    this.chairman_account = props.chairman_account;
    this.signiss1_tx_hash = props.signiss1_tx_hash;
    this.orderer_signed_at = props.orderer_signed_at;
    this.delivery_signer_account = props.delivery_signer_account;
    this.signiss2_tx_hash = props.signiss2_tx_hash;
    this.on_chain_id = props.on_chain_id;
    this.on_chain_block_num = props.on_chain_block_num;
    this.on_chain_present = props.on_chain_present;
    this.created_at = props.created_at;
    this.updated_at = props.updated_at;
  }

  // ── IBlockchainSynchronizable ──────────────────────────────────────

  public getBlockNum(): number | undefined {
    return this.on_chain_block_num ?? undefined;
  }

  public getPrimaryKey(): string {
    return this.id;
  }

  public getSyncKey(): string {
    return 'order_hash';
  }

  /**
   * Story 4.1: вызывается из `AbstractEntitySyncService.handleSyncDelta`
   * при поступлении дельты `marketplace::orders` row. Обновляет
   * on-chain-зеркало без затрагивания backend-only полей (`cycle_id`,
   * `create_tx`, `last_status_reason`).
   *
   * Мутация состояния — единственный allowed point (по ADR-008 принципу
   * «sync обновляет только blockchain-зеркало, не destructively touch
   * backend snapshot»).
   */
  public updateFromBlockchain(
    blockchainData: MarketplaceOrderBlockchainData,
    blockNum: number,
    present = true
  ): void {
    if (this.order_hash !== blockchainData.order_hash.toLowerCase()) {
      throw new Error(
        `MarketplaceOrderDomainEntity.updateFromBlockchain: sync-key mismatch (local=${this.order_hash}, incoming=${blockchainData.order_hash})`
      );
    }
    this.on_chain_id = blockchainData.on_chain_id;
    this.on_chain_block_num = blockNum;
    this.on_chain_present = present;
    this.status = blockchainData.status;
    this.updated_at = new Date();
  }

  // ── Derived (детерминированы, без new Date()) ──────────────────────

  public get is_active(): boolean {
    return this.status === 'ACTIVE';
  }

  public get is_terminal(): boolean {
    return (
      this.status === 'CANCELLED_BY_ORDERER' ||
      this.status === 'CANCELLED_BY_SUPPLIER' ||
      this.status === 'EXPIRED_NO_THRESHOLD' ||
      this.status === 'EXPIRED_NO_VOLUME' ||
      this.status === 'RETURNED'
    );
  }

  /**
   * Можно ли в этом статусе отменить Order заказчиком (Story 4.4).
   */
  public get can_be_cancelled_by_orderer(): boolean {
    return (
      this.status === 'ACTIVE' ||
      this.status === 'ACCEPTED_PENDING_SUPPLIER' ||
      this.status === 'ACCEPTED_PENDING_SUPPLIER_INDIVIDUAL'
    );
  }

  /**
   * Был ли Order в block-состоянии (т.е. при rollback'е цепи нужно
   * вернуть Story 3.4 counter через `onOrderRolledBack`). Все статусы
   * до `RECEIVED` включают активный BLOCK на `w.mkt.member`.
   */
  public get is_in_block_state(): boolean {
    return (
      this.status === 'ACTIVE' ||
      this.status === 'ACCEPTED_PENDING_SUPPLIER' ||
      this.status === 'ACCEPTED_PENDING_SUPPLIER_INDIVIDUAL' ||
      this.status === 'ACCEPTED' ||
      this.status === 'SUPPLY_PREPARED' ||
      this.status === 'ACCEPTED_TO_COOP' ||
      this.status === 'READY_TO_RECEIVE'
    );
  }

  /**
   * Story 6.1: ожидает первой подписи председателя КУ (открытие выдачи).
   */
  public get awaits_chairman_issue_open(): boolean {
    return this.status === 'ACCEPTED_TO_COOP' && this.chairman_signed_at === null;
  }

  /**
   * Story 6.3: ожидает финальной подписи заказчика (получение имущества).
   */
  public get awaits_orderer_issue_final(): boolean {
    return this.status === 'READY_TO_RECEIVE' && this.orderer_signed_at === null;
  }

  /**
   * Story 6.3: имущество выдано пайщику — Order закрыт получением.
   */
  public get is_received(): boolean {
    return this.status === 'RECEIVED';
  }
}

/**
 * Blockchain-снимок поля `marketplace::orders` row после mapper'а.
 */
export interface MarketplaceOrderBlockchainData {
  order_hash: string;
  on_chain_id: string;
  status: MarketplaceOrderStatus;
}
