/**
 * Story 5.3 / 5.4: типы Акта Приёмки Партии (АПП) — структуры двухподписной
 * приёмки имущества на КУ. Backend ведёт композицию: connecter с
 * консолидированной заявкой через Shipment; per-Order ledger2-операции
 * фиксируются on-chain на закрывающей подписи председателя (Story 5.6).
 */

import type { MarketplaceShipmentTTNData } from './marketplace-shipment.types';
import type { ISignedDocumentDomainInterface } from '@coopenomics/innercoop';

/**
 * Вариант приёмки: А — поставщик лично прибыл; Б — экспедитор + ТТН
 * с асинхронной подписью отсутствующего поставщика.
 */
export type MarketplaceAplReceptionVariant = 'A' | 'B';

export const MarketplaceAplReceptionVariants = {
  IN_PERSON: 'A',
  EXPEDITOR: 'B',
} as const satisfies Record<string, MarketplaceAplReceptionVariant>;

/**
 * Статус АПП.
 *
 *  - `PENDING_SUPPLIER_SIGN` — Вариант Б: акт сформирован оператором, ждёт
 *    асинхронной подписи поставщика; либо Вариант А: ждёт первой подписи
 *    лично прибывшего поставщика.
 *  - `PENDING_CHAIRMAN_RECEPTION_SIGN` — поставщик подписал; ждём закрывающую
 *    подпись председателя КУ.
 *  - `ACCEPTED_TO_COOP` — председатель подписал; on-chain `signchair`
 *    выполнен per-Order с o.mkt.purch + outgoing_payment (Story 5.6).
 *  - `CANCELLED` — отозван (резерв; в MVP не автоматизирован, кооператив
 *    решает вручную по edge-case'у «поставщик не подписывает», Story 5.4).
 */
export type MarketplaceAplReceptionStatus =
  | 'PENDING_SUPPLIER_SIGN'
  | 'PENDING_CHAIRMAN_RECEPTION_SIGN'
  | 'ACCEPTED_TO_COOP'
  | 'CANCELLED';

export const MarketplaceAplReceptionStatuses = {
  PENDING_SUPPLIER_SIGN: 'PENDING_SUPPLIER_SIGN',
  PENDING_CHAIRMAN_RECEPTION_SIGN: 'PENDING_CHAIRMAN_RECEPTION_SIGN',
  ACCEPTED_TO_COOP: 'ACCEPTED_TO_COOP',
  CANCELLED: 'CANCELLED',
} as const satisfies Record<string, MarketplaceAplReceptionStatus>;

/**
 * Снапшот данных экспедитора + ТТН на момент создания АПП (Вариант Б).
 * Копируется из Shipment.ttn_data, чтобы АПП было самодостаточным
 * документом и не зависел от изменения исходной партии.
 */
export type MarketplaceAplReceptionExpeditorData = MarketplaceShipmentTTNData;

/**
 * Фактически принятое количество per-Order (для Варианта Б — оператор
 * корректирует при расхождении против заявки; для Варианта А — по
 * умолчанию равно order.quantity, расхождение фиксируется отказом
 * приёмки).
 */
export interface MarketplaceAplReceptionFactQuantityEntry {
  order_id: string;
  fact_quantity: number;
  /**
   * Фактическая цена за единицу, скорректированная оператором при открытии
   * приёмки (привезли хуже/другое — принимаем со скидкой). Бэйр-десятичная
   * строка как `price_per_unit` (без символа валюты). При отсутствии берётся
   * order.price_per_unit.
   */
  fact_unit_price?: string;
}

export interface MarketplaceAplReceptionProps {
  id: string;
  coopname: string;
  shipment_id: string;
  cycle_id: string;
  braname: string;
  offerer_account: string;
  variant: MarketplaceAplReceptionVariant;
  status: MarketplaceAplReceptionStatus;
  fact_quantity_per_order: MarketplaceAplReceptionFactQuantityEntry[];
  ttn_number: string | null;
  expeditor_data: MarketplaceAplReceptionExpeditorData | null;
  created_by_operator_account: string;
  supplier_signed_at: Date | null;
  supplier_signsupp_tx_hash: string | null;
  /**
   * Документы, подписанные поставщиком (один на Order группы), как их прислал
   * клиент в signsupp. Хранятся, чтобы при закрывающей подписи отдать
   * председателю подпись поставщика (поле `document` агрегата) — фронт цепь
   * не читает. Тело документа достаётся отдельно по doc_hash из стора.
   */
  supplier_signed_documents: ISignedDocumentDomainInterface[] | null;
  chairman_signed_at: Date | null;
  chairman_account: string | null;
  chairman_signchair_tx_hash: string | null;
  /** Сумма АПП = Σ fact_quantity * price_per_unit (рассчитывается на момент создания). */
  total_amount: string;
  created_at: Date;
  updated_at: Date;
}
