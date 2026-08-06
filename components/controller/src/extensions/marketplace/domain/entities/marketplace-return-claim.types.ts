/**
 * Эпик 7 (Story 7.1-7.4): типы заявления на гарантийный возврат имущества.
 * Backend-only state machine, on-chain якорь — `marketplace::return_request`
 * (анкер процесса p.mkt.return). Compensating-forward `o.mkt.return`
 * (ISSUE w.wal.member, Дт 10 / Кт 86) выполняется в `accretrn`.
 *
 * Источник правды графа состояний — `p.mkt.return.standard.yaml` секция
 * `states:`; контрактные имена статусов в `ReturnStatus::*` ядра
 * (`pendrev / approvvisit / accepted / rejremote / rejatku`).
 */

import type { ISignedDocumentDomainInterface } from '~/domain/document/interfaces/signed-document-domain.interface';

/**
 * Категория дефекта — опциональный признак для фасеточной аналитики
 * (по согласованию с продакт-менеджером может расширяться без миграции).
 */
export type MarketplaceReturnClaimDefectCategory =
  | 'BROKEN'
  | 'EXPIRED'
  | 'NOT_AS_DESCRIBED'
  | 'WRONG_ITEM'
  | 'OTHER';

export const MarketplaceReturnClaimDefectCategories = {
  BROKEN: 'BROKEN',
  EXPIRED: 'EXPIRED',
  NOT_AS_DESCRIBED: 'NOT_AS_DESCRIBED',
  WRONG_ITEM: 'WRONG_ITEM',
  OTHER: 'OTHER',
} as const satisfies Record<string, MarketplaceReturnClaimDefectCategory>;

/**
 * Какое разрешение ожидает пайщик. В MVP — только возврат средств на
 * универсальный членский кошелёк (`w.wal.member.available`). Расширения
 * (`REPLACEMENT`, `REPAIR`) — Phase 2 (out of MVP).
 */
export type MarketplaceReturnClaimExpectedResolution = 'FUNDS_RETURN';

export const MarketplaceReturnClaimExpectedResolutions = {
  FUNDS_RETURN: 'FUNDS_RETURN',
} as const satisfies Record<string, MarketplaceReturnClaimExpectedResolution>;

/**
 * Статусы заявления. Маппинг на контрактные имена `ReturnStatus::*` ниже:
 *
 *   PENDING_CHAIRMAN_REVIEW   ↔ pendrev      (Story 7.1 — после submretrn)
 *   APPROVED_FOR_VISIT        ↔ approvvisit  (Story 7.2 — после aprretrem)
 *   REJECTED_REMOTELY         ↔ rejremote    (Story 7.2 — после rejretrem)
 *   ACCEPTED_AT_VISIT         ↔ accepted     (Story 7.4 — после accretrn,
 *                                              composite forward выполнен)
 *   REJECTED_AT_VISIT         ↔ rejatku      (Story 7.3 — после rejretrn)
 */
export type MarketplaceReturnClaimStatus =
  | 'PENDING_CHAIRMAN_REVIEW'
  | 'APPROVED_FOR_VISIT'
  | 'REJECTED_REMOTELY'
  | 'ACCEPTED_AT_VISIT'
  | 'REJECTED_AT_VISIT';

export const MarketplaceReturnClaimStatuses = {
  PENDING_CHAIRMAN_REVIEW: 'PENDING_CHAIRMAN_REVIEW',
  APPROVED_FOR_VISIT: 'APPROVED_FOR_VISIT',
  REJECTED_REMOTELY: 'REJECTED_REMOTELY',
  ACCEPTED_AT_VISIT: 'ACCEPTED_AT_VISIT',
  REJECTED_AT_VISIT: 'REJECTED_AT_VISIT',
} as const satisfies Record<string, MarketplaceReturnClaimStatus>;

/**
 * Снапшот фото-доказательства, приложенного пайщиком к заявлению
 * (Story 7.1) либо председателем при очном осмотре (Story 7.3).
 *
 * `bucket_key` — ключ объекта в bucket'е `stol-zakazov:images` (формат
 * `returns/<claim_id>/<role>/<index>.<ext>`). `content_hash` — sha256
 * содержимого, ровно тот же checksum используется в `photos[]` параметра
 * `submretrn` на цепи (двусторонняя сверка вычислений: backend bucket +
 * on-chain hash).
 */
export interface MarketplaceReturnClaimPhoto {
  bucket_key: string;
  content_hash: string;
  mime_type: string;
  uploaded_at: Date;
}

/**
 * Запись о решении председателя — append-only, журналирует «кто, когда,
 * каким действием, с какой репликой». Используется UI заказчика и
 * audit-trail.
 */
export interface MarketplaceReturnClaimDecisionLogEntry {
  /** Логическая стадия процесса: 'remote' (Story 7.2) либо 'on_site' (Story 7.3). */
  stage: 'remote' | 'on_site';
  /** Решение председателя на стадии. */
  decision: 'approve_visit' | 'reject_remote' | 'accept_at_visit' | 'reject_at_visit';
  by_chairman_account: string;
  /** КУ, под которым председатель принимал решение. */
  braname: string;
  comment: string;
  at: Date;
  /** tx_hash on-chain action, выполнившего решение (aprretrem / rejretrem / accretrn / rejretrn). */
  tx_hash: string;
}

/**
 * Снапшот compensating-forward `o.mkt.return`, выполненной в транзакции
 * `accretrn` (Story 7.4). Снимок — для архива и UI; источник правды —
 * ledger2 journal.
 */
export interface MarketplaceReturnClaimLedgerSnapshot {
  /** Сумма compensating forward (равна order.fact_cost для returned_quantity = actual_quantity Order'а). */
  amount: string;
  /** Возвращённое количество — в MVP всегда равно actual_quantity исходного Order'а. */
  returned_quantity: number;
  /** Композитная транзакция accretrn. */
  tx_hash: string;
  /** Время фиксации возврата. */
  at: Date;
}

/**
 * Параметры очного осмотра — заполняются на стадии Story 7.3.
 */
export interface MarketplaceReturnClaimOnSiteInspection {
  /** Текстовое описание результата осмотра (≤ 2000 символов). */
  result_text: string;
  /** Фото очного осмотра (опционально, ≤ 10 шт). */
  photos: MarketplaceReturnClaimPhoto[];
  /** Считанный штрих-код имущества (для сверки с Order). */
  scanned_barcode: string | null;
  /** Председатель, проводивший осмотр. */
  by_chairman_account: string;
  /** Время очного осмотра. */
  at: Date;
}

export interface MarketplaceReturnClaimProps {
  id: string;
  coopname: string;
  /** Якорный hash on-chain return_request (`request_hash` параметр submretrn). */
  request_hash: string;
  order_id: string;
  order_hash: string;
  orderer_account: string;
  /** КУ, на котором имущество было выдано (delivery_braname Order'а в момент submretrn). */
  delivery_braname: string;
  /** Поставщик исходного заказа — фиксируется для будущего возврата поставщику (Phase 2). */
  supplier_account: string;
  status: MarketplaceReturnClaimStatus;
  reason_text: string;
  defect_category: MarketplaceReturnClaimDefectCategory | null;
  expected_resolution: MarketplaceReturnClaimExpectedResolution;
  /** Возвращаемое количество — по умолчанию = order.actual_quantity, может быть меньше (но > 0). */
  actual_quantity: number;
  /** Возвращаемая стоимость имущества = actual_quantity × unit_price (рассчитывается на submit). */
  fact_cost: string;
  /**
   * Возвращаемая доля членского взноса (рассчитывается на submit пропорционально
   * возвращаемому количеству). Вместе с fact_cost составляет полную сумму,
   * которую пайщик получает обратно: гарантийный возврат возвращает и стоимость
   * имущества, и уплаченный за него взнос. У заявлений, поданных до введения
   * возврата взноса, — отсутствует (трактуется как 0).
   */
  fee_refund?: string;
  photos: MarketplaceReturnClaimPhoto[];
  /**
   * Подписанное пайщиком заявление (registry 1104) — сохраняется при подаче,
   * чтобы председатель мог наложить вторую подпись при принятии возврата
   * (агрегат для со-подписи строится из этого документа).
   */
  statement: ISignedDocumentDomainInterface | null;
  /** tx_hash on-chain submretrn (хранится для трассировки). */
  submretrn_tx_hash: string;
  decision_log: MarketplaceReturnClaimDecisionLogEntry[];
  /** Заполняется в Story 7.3 (accretrn / rejretrn). */
  on_site_inspection: MarketplaceReturnClaimOnSiteInspection | null;
  /** Снапшот compensating forward (только при status = ACCEPTED_AT_VISIT). */
  ledger_snapshot: MarketplaceReturnClaimLedgerSnapshot | null;
  created_at: Date;
  updated_at: Date;
}
