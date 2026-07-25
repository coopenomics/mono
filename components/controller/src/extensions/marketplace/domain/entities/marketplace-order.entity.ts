import type {
  MarketplaceOrderCreateTxSnapshot,
  MarketplaceOrderIssuanceFactSnapshot,
  MarketplaceOrderProps,
  MarketplaceOrderStatus,
} from './marketplace-order.types';
import type { MarketplaceUnitOfMeasure } from './marketplace-offer.types';
import type { ISignedDocumentDomainInterface } from '~/domain/document/interfaces/signed-document-domain.interface';
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
  public readonly unit_of_measure: MarketplaceUnitOfMeasure;
  public readonly price_per_unit: string;
  /** Содержимое упаковки в базовой единице (Эпик 18); 0 = отпуск по мере. */
  public readonly package_size: number;
  public readonly total_cost: string;
  /** Членский взнос, включённый в стоимость заказа — on-chain mirror (см. MarketplaceOrderProps). */
  public membership_fee: string | null;
  public readonly cycle_id: string | null;
  /** Грань «заказ заказчика» (Эпик 16): общий id строк одного оформления на один КУ; null = legacy покарточный заказ. */
  public readonly checkout_id: string | null;
  /** Партия, в которую заказ включён при формировании (null = вне партии). */
  public shipment_id: string | null;
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
  public issue_act_signiss1_document: ISignedDocumentDomainInterface | null;
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
    this.unit_of_measure = props.unit_of_measure;
    this.price_per_unit = props.price_per_unit;
    this.package_size = props.package_size;
    this.total_cost = props.total_cost;
    this.membership_fee = props.membership_fee;
    this.cycle_id = props.cycle_id;
    this.checkout_id = props.checkout_id;
    this.shipment_id = props.shipment_id;
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
    this.issue_act_signiss1_document = props.issue_act_signiss1_document;
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
    // membership_fee — immutable on-chain snapshot (контракт пишет его один
    // раз при createorder), безусловный overwrite идемпотентен.
    this.membership_fee = blockchainData.membership_fee;
    // Forward-only guard. Backend опережает цепь на нескольких переходах
    // «прямого пути»: cycle-hook / синтез индивидуальной заявки переводят
    // Order в ACCEPTED_PENDING_SUPPLIER(_INDIVIDUAL) и далее ACCEPTED /
    // SUPPLY_PREPARED ДО того, как соответствующая on-chain дельта
    // (`active`→`accepted`) материализуется. Запоздавшая дельта с более РАННИМ
    // статусом не должна откатывать backend назад — иначе individual-заказ
    // «возвращается» в каталог (ACTIVE) или SUPPLY_PREPARED сбрасывается в
    // ACCEPTED и партия на приёмке теряет заказ. Терминальные статусы (отмена/возврат/
    // просрочка) — rank=undefined → применяются всегда: это реальные
    // on-chain события, которые перекрывают любой backend-прогресс.
    const incomingRank = MARKETPLACE_ORDER_FORWARD_RANK[blockchainData.status];
    const currentRank = MARKETPLACE_ORDER_FORWARD_RANK[this.status];
    const isBackendAhead =
      incomingRank !== undefined && currentRank !== undefined && incomingRank < currentRank;
    // Terminal-resurrection guard. Заказ в терминальной отмене/возврате
    // (CANCELLED_*/RETURNED) стёрт из chain-RAM (decline/cancel/return = erase
    // строки, не смена статуса). Парсер на erase шлёт дельту с present=false, в
    // value которой — ПОСЛЕДНЕЕ «живое» состояние стёртой строки (как правило
    // ещё 'active'). Mapper выдаёт только живые on-chain статусы ('cancelled' —
    // KNOWN_UNMAPPED → null), поэтому ЛЮБОЙ приходящий статус поверх
    // терминального = воскрешение стёртой строки. Без guard'а отклонённый заказ
    // «возвращался» в ACTIVE (backend уже выставил CANCELLED_BY_SUPPLIER, но
    // erase-дельта перетирала его — у терминала forward-rank=undefined), снова
    // всплывал в списке «Ждут акцепта», а повторный decline/accept падал
    // «заказ не найден по хэшу» (on-chain строки уже нет). Точный терминальный
    // под-статус выставляет backend в момент submit — он и есть источник истины.
    if (!isBackendAhead && !this.is_terminal) {
      this.status = blockchainData.status;
    }
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
   * Был ли Order в состоянии активного резерва (т.е. при rollback'е цепи
   * нужно вернуть Story 3.4 counter через `onOrderRolledBack`). Все
   * статусы до `RECEIVED` включают активный резерв на `w.mkt.order`.
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
 * Монотонный ранг статусов «прямого пути» Order'а. Используется в
 * `updateFromBlockchain` как forward-only guard: запоздавшая on-chain
 * дельта с меньшим рангом не откатывает опережающий backend-статус.
 * Терминальные статусы (RETURNED / CANCELLED_* / EXPIRED_*) намеренно НЕ
 * входят в таблицу (rank=undefined) — они применяются всегда, перекрывая
 * любой backend-прогресс.
 */
const MARKETPLACE_ORDER_FORWARD_RANK: Partial<Record<MarketplaceOrderStatus, number>> = {
  ACTIVE: 0,
  ACCEPTED_PENDING_SUPPLIER: 1,
  ACCEPTED_PENDING_SUPPLIER_INDIVIDUAL: 1,
  ACCEPTED: 2,
  SUPPLY_PREPARED: 3,
  ACCEPTED_TO_COOP: 4,
  READY_TO_RECEIVE: 5,
  RECEIVED: 6,
};

/**
 * Blockchain-снимок поля `marketplace::orders` row после mapper'а.
 */
export interface MarketplaceOrderBlockchainData {
  order_hash: string;
  on_chain_id: string;
  status: MarketplaceOrderStatus;
  /** Членский взнос из on-chain `order` row (requirement b6), null — старая строка без поля. */
  membership_fee: string | null;
}
