import type {
  MarketplaceOrderCreateTxSnapshot,
  MarketplaceOrderIssuanceFactSnapshot,
  MarketplaceOrderStatus,
} from '../../domain/entities/marketplace-order.types';
import {
  MarketplaceUnitsOfMeasure,
  type MarketplaceUnitOfMeasure,
} from '../../domain/entities/marketplace-offer.types';

/**
 * Story 4.1: TypeORM-сущность Order'а Стола заказов. Зеркало
 * on-chain `marketplace::orders` (canonical Story 11.1) + backend-only
 * поля для cycle-агрегации (Эпик 4) и трассировки create-tx.
 *
 * Hot-path индексы:
 *   - `(coopname, orderer_account, status)` — Story 4.6 «Мои заказы»
 *     (orderer filter + per-status group);
 *   - `(coopname, supplier_account, status)` — offerer-стол Stories 4.5/4.6;
 *   - `(coopname, status, created_at)` — admin/cron-сканер цикла (4.2/4.3);
 *   - `(order_hash)` уникальный — sync-key поиск syncer'а;
 *   - `(offer_id, status)` — counters-инвариант Story 3.4 (sanity-check).
 *
 * DDL создаётся через TypeORM `synchronize:true` (паттерн PR #382 для
 * остальных marketplace_* таблиц).
 */
export class MarketplaceOrderEntity {
  public id!: string;

  public coopname!: string;

  /**
   * Sync-key — 64-символьный hex без `0x`, lowercase. Соответствует
   * `marketplace::orders.hash` (checksum256 на цепи).
   */
  public order_hash!: string;

  public orderer_account!: string;

  public offer_id!: string;

  public offer_hash!: string;

  public supplier_account!: string;

  public delivery_braname!: string;

  // Дробное количество (Эпик 17): numeric в базовой единице; transformer
  // возвращает number. Точность 3 — граммы/миллилитры (KG/LTR); PCS — целое.
  public quantity!: number;

  // Единица измерения заказа, денормализованная из Offer'а при создании (как и
  // price_per_unit): нужна для сборки on-chain asset-количества (символ KG/LTR/
  // PCS) на выдаче/приёмке/возврате и для форматирования в актах/UI.
  public unit_of_measure!: MarketplaceUnitOfMeasure;

  // numeric → string в TypeORM; PR #382 паттерн (см. marketplace_offer).
  // Эпик 18: цена за единицу отпуска — за базовую единицу при отпуске по мере,
  // за упаковку при упаковочном (package_size > 0).
  public price_per_unit!: string;

  /**
   * Содержимое упаковки в базовой единице, снапшот выбранной упаковки оффера
   * (Эпик 18). 0 = отпуск по мере (price_per_unit за базовую единицу); >0 =
   * упаковкой (price_per_unit за упаковку, quantity кратно package_size).
   * `synchronize:true` создаёт колонку с default 0.
   */
  public package_size!: number;

  /**
   * Упаковка каталога предложения, которой оформлен заказ (остаток по
   * упаковкам): по ней счётчик упаковки возвращает штуки при отмене и откате.
   * NULL — отпуск по мере либо заказ до появления поля; миграция V2.5.7
   * дозаполняет старые заказы по содержимому упаковки.
   */
  public package_id!: string | null;

  public total_cost!: string;

  /**
   * Backend-only Story 4.2 cycle aggregation key (FK на
   * `marketplace_consolidated_request.id`). На Story 4.1 — всегда null.
   */
  public cycle_id!: string | null;

  /**
   * Грань «заказ заказчика» (Эпик 16): общий идентификатор всех строк
   * одного оформления корзины на один КУ. Штампуется при checkout'е; до
   * перехода на корзину (legacy покарточный заказ) — null. Один checkout_id
   * = один `delivery_braname` (инвариант «один заказ — один КУ» enforced
   * на уровне сервиса оформления).
   */
  public checkout_id!: string | null;

  /**
   * Backend-only: партия (`marketplace_shipment.id`), в которую заказ включён
   * при формировании. null = акцептован, но в партию не вошёл. Связь позволяет
   * нескольким частичным партиям сосуществовать на одном (cycle, КУ): приёмка
   * резолвит состав партии по `shipment_id`, а не по (cycle, braname).
   */
  public shipment_id!: string | null;

  public warranty_period_secs!: number;

  public warranty_until!: Date | null;

  public status!: MarketplaceOrderStatus;

  public last_status_reason!: string | null;

  public blocked_at!: Date | null;

  public accepted_at!: Date | null;

  public received_at!: Date | null;

  public cancelled_at!: Date | null;

  /**
   * Снапшот ledger2 createorder-операции: tx_hash, block_num, locked_amount.
   * Используется для отображения свежего движения резерва в `WalletTimeline`
   * (UX-DR8) сразу после успеха.
   */
  public create_tx!: MarketplaceOrderCreateTxSnapshot | null;

  // ── Story 6.1 / FR21 — открытие выдачи (signiss1) ──────────────────────

  /**
   * ПВЗ, на котором имущество фактически лежит к моменту выдачи. На
   * `signiss1` приравнивается `delivery_braname`; промежуточные перемещения
   * по заготовочным КУ контрактом не подписываются.
   */
  public current_warehouse_braname!: string | null;

  /** Снапшот фактической выдачи после `signiss2` (factual quantity, fact_cost, diff_state). */
  public issuance_fact!: MarketplaceOrderIssuanceFactSnapshot | null;

  /**
   * Момент ручного объявления готовности к выдаче оператором КУ («Объявить
   * выдачу»). Backend-only операционный сигнал — статус не меняется, on-chain
   * не пишется; триггерит push заказчику и бейдж «Готово к выдаче».
   */
  public ready_announced_at!: Date | null;

  // ── Паевая модель: выдача по заявлению, протоколу совета и акту (компонент 68) ──

  /** Момент подписи заявления о возврате паевого взноса имуществом (`issuestmt`). */
  public issue_statement_at!: Date | null;

  /** Номер решения совета по выдаче (soviet.decisions). */
  public issue_decision_id!: string | null;

  /** Сторона кооператива, закрывшая выдачу второй подписью акта (`issueact2`). */
  public delivery_signer_account!: string | null;

  public issue_closed_tx_hash!: string | null;

  // ── On-chain mirror (поля от syncer'а через `marketplace::orders` row) ──

  /** uint64 id из on-chain row (как string из pg numeric). */
  public on_chain_id!: string | null;

  public on_chain_block_num!: number | null;

  public on_chain_present!: boolean;

  /**
   * Членский взнос, включённый в стоимость заказа (requirement b6). Контракт
   * сам считает и пишет его в `order` row при `createorder` — это on-chain
   * mirror, не backend-вычисление (см. domain MarketplaceOrderBlockchainData).
   * Null до первой sync-дельты и у заказов, созданных до появления поля.
   */
  public membership_fee!: string | null;

  /**
   * Принятая стоимость по закрывающей подписи акта приёмки — on-chain mirror
   * `accepted_cost` (задача 99D-14). Null до приёмки и у заказов, принятых до
   * появления поля на контракте.
   */
  public accepted_cost!: string | null;

  /** Состояние выплаты поставщику — on-chain mirror `payout_status`. Null до первой sync-дельты. */
  public payout_status!: string | null;

  /** Списанная уценка — on-chain mirror `markdown_cost`. Null до первой sync-дельты. */
  public markdown_cost!: string | null;

  /**
   * Уценка, рассчитанная бэкендом при закрытии выдачи и ожидающая проведения
   * на цепи (задача 99D-15). Backend-only: крон повторяет `markdown`, пока
   * `markdown_cost` на цепи пуст; закрытие заказа до этого откладывается.
   */
  public markdown_due!: string | null;

  public created_at!: Date;

  public updated_at!: Date;
}
