/**
 * Эпик 7 + компонент 68 (паевая модель): типы заявления на гарантийный
 * возврат имущества. Backend-only state machine, on-chain якорь —
 * `marketplace::return_request` (процесс p.mkt.return). Деньги двигаются
 * только по решению совета: обратный вызов `onmktrtauth` одной транзакцией
 * откатывает все движения по выданному заказу (паевой взнос на свободный
 * паевой «Стола заказов», членский взнос участка — обратно пайщику).
 *
 * Источник правды графа состояний — `p.mkt.return.standard.yaml` секция
 * `states:`; контрактные имена статусов в `ReturnStatus::*` ядра
 * (`pendrev / approvvisit / rejremote / rejatku / retpend / retdecl`).
 */

import type { ISignedDocument } from '@coopenomics/innercoop';

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
 * Какое разрешение ожидает пайщик. В MVP — только восстановление паевого
 * взноса (свободный паевой «Стола заказов»). Расширения (`REPLACEMENT`,
 * `REPAIR`) — Phase 2 (out of MVP).
 */
export type MarketplaceReturnClaimExpectedResolution = 'FUNDS_RETURN';

export const MarketplaceReturnClaimExpectedResolutions = {
  FUNDS_RETURN: 'FUNDS_RETURN',
} as const satisfies Record<string, MarketplaceReturnClaimExpectedResolution>;

/**
 * Статусы заявления. Маппинг на контрактные имена `ReturnStatus::*`:
 *
 *   PENDING_CHAIRMAN_REVIEW ↔ pendrev     — после submretrn (заявление 1116 подписано пайщиком)
 *   APPROVED_FOR_VISIT      ↔ approvvisit — после aprretrem (приглашён на участок)
 *   REJECTED_REMOTELY       ↔ rejremote   — после rejretrem (финал)
 *   REJECTED_AT_VISIT       ↔ rejatku     — оператор не стал принимать имущество (финал)
 *   PENDING_COUNCIL         ↔ retpend     — имущество принято у стойки, заявление на повестке совета
 *   ACCEPTED_BY_COUNCIL     ↔ (запись стёрта) — совет «за»: все движения откачены, финал
 *   DECLINED_BY_COUNCIL     ↔ retdecl     — совет «против»: имущество ждёт пайщика на участке
 *   HANDED_BACK             ↔ (запись стёрта) — оператор выдал имущество обратно (финал)
 */
export type MarketplaceReturnClaimStatus =
  | 'PENDING_CHAIRMAN_REVIEW'
  | 'APPROVED_FOR_VISIT'
  | 'REJECTED_REMOTELY'
  | 'REJECTED_AT_VISIT'
  | 'PENDING_COUNCIL'
  | 'ACCEPTED_BY_COUNCIL'
  | 'DECLINED_BY_COUNCIL'
  | 'HANDED_BACK';

export const MarketplaceReturnClaimStatuses = {
  PENDING_CHAIRMAN_REVIEW: 'PENDING_CHAIRMAN_REVIEW',
  APPROVED_FOR_VISIT: 'APPROVED_FOR_VISIT',
  REJECTED_REMOTELY: 'REJECTED_REMOTELY',
  REJECTED_AT_VISIT: 'REJECTED_AT_VISIT',
  PENDING_COUNCIL: 'PENDING_COUNCIL',
  ACCEPTED_BY_COUNCIL: 'ACCEPTED_BY_COUNCIL',
  DECLINED_BY_COUNCIL: 'DECLINED_BY_COUNCIL',
  HANDED_BACK: 'HANDED_BACK',
} as const satisfies Record<string, MarketplaceReturnClaimStatus>;

/** Заявление ещё в работе: у стойки, на повестке совета или ждёт выдачи обратно. */
export const MARKETPLACE_RETURN_CLAIM_ACTIVE_STATUSES: readonly MarketplaceReturnClaimStatus[] = [
  'PENDING_CHAIRMAN_REVIEW',
  'APPROVED_FOR_VISIT',
  'PENDING_COUNCIL',
  'DECLINED_BY_COUNCIL',
];

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

/** Стадия решения по заявлению: удалённо, у стойки, совет. */
export type MarketplaceReturnClaimDecisionStage = 'remote' | 'on_site' | 'council';

/**
 * Решение по заявлению на стадии:
 *  - approve_visit / reject_remote — оператор удалённо;
 *  - accept_at_visit (имущество принято, заявление на совет) / reject_at_visit — у стойки;
 *  - council_authorized / council_declined — совет (робот или люди);
 *  - hand_back — оператор выдал имущество обратно.
 */
export type MarketplaceReturnClaimDecision =
  | 'approve_visit'
  | 'reject_remote'
  | 'accept_at_visit'
  | 'reject_at_visit'
  | 'council_authorized'
  | 'council_declined'
  | 'hand_back';

/**
 * Запись о решении — append-only, журналирует «кто, когда, каким действием,
 * с какой репликой». Используется UI заказчика и audit-trail. Для решений
 * совета `by_chairman_account` — аккаунт кооператива (решение коллегиальное).
 */
export interface MarketplaceReturnClaimDecisionLogEntry {
  stage: MarketplaceReturnClaimDecisionStage;
  decision: MarketplaceReturnClaimDecision;
  by_chairman_account: string;
  /** КУ, под которым председатель принимал решение. */
  braname: string;
  comment: string;
  at: Date;
  /** tx_hash on-chain action, выполнившего решение (aprretrem / rejretrem / accretrn / rejretrn / onmktrt* / handback). */
  tx_hash: string;
}

/**
 * Снапшот отката движений по решению совета (`onmktrtauth`): паевой взнос за
 * имущество и членский взнос участка восстановлены пайщику. Снимок — для
 * архива и UI; источник правды — журнал Ledger2.
 */
export interface MarketplaceReturnClaimLedgerSnapshot {
  /** Полная восстановленная сумма: стоимость имущества + членский взнос за него. */
  amount: string;
  /** Возвращённое количество — равно actual_quantity заявления. */
  returned_quantity: number;
  /** Транзакция обратного вызова совета (onmktrtauth). */
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
   * Подписанное пайщиком Заявление о внесении паевого взноса имуществом
   * (registry 1116) — сохраняется при подаче, чтобы оператор мог наложить
   * вторую подпись при приёме имущества (агрегат для со-подписи строится из
   * этого документа); с обеими подписями уходит в повестку совета.
   */
  statement: ISignedDocument | null;
  /** Номер решения совета (soviet.decisions) — известен после приёма имущества у стойки. */
  council_decision_id: string | null;
  /** Кто решает: робот совета либо люди (нет кворума / робот не настроен). Null — совет ещё не задействован. */
  council_decision_mode: 'ROBOT' | 'MANUAL' | null;
  /** Протокол решения совета (1117) — после `onmktrtauth`. */
  council_protocol: ISignedDocument | null;
  /** Момент приёма имущества у стойки (accretrn) — от него контракт считает срок ожидания решения. */
  accepted_at: Date | null;
  /** tx_hash on-chain submretrn (хранится для трассировки). */
  submretrn_tx_hash: string;
  decision_log: MarketplaceReturnClaimDecisionLogEntry[];
  /** Заполняется у стойки (accretrn / rejretrn). */
  on_site_inspection: MarketplaceReturnClaimOnSiteInspection | null;
  /** Снапшот отката движений (только при status = ACCEPTED_BY_COUNCIL). */
  ledger_snapshot: MarketplaceReturnClaimLedgerSnapshot | null;
  created_at: Date;
  updated_at: Date;
}
