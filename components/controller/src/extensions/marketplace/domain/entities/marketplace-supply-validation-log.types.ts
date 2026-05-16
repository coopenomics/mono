/**
 * Story 5.2: журнал валидаций состава поставки. Каждый раз когда поставщик
 * формирует Shipment (либо отдельно вызывает validate-эндпоинт перед «Готов
 * везти»), backend фиксирует попытку — успешную или с reason'ом отказа.
 *
 * Используется audit-трассой для постановки техдолгов UI («поставщик пытался
 * подменить SKU 14 раз»), а также входит в Stories 4-6 при reconciliation.
 */

/** Результат валидации. */
export type MarketplaceSupplyValidationOutcome = 'OK' | 'REJECTED';

export const MarketplaceSupplyValidationOutcomes = {
  OK: 'OK',
  REJECTED: 'REJECTED',
} as const satisfies Record<string, MarketplaceSupplyValidationOutcome>;

/** Код причины отказа (для индексации и UX-локализации). */
export type MarketplaceSupplyValidationReason =
  | 'CYCLE_NOT_ACCEPTED'
  | 'ORDER_SET_MISMATCH'
  | 'QUANTITY_PER_OFFER_MISMATCH'
  | 'PRICE_PER_UNIT_CHANGED'
  | 'KU_GROUPS_OVERLAP'
  | 'EMPTY_GROUPS'
  | 'UNKNOWN_ORDER'
  | 'NON_OFFERER_ACCOUNT';

export const MarketplaceSupplyValidationReasons = {
  CYCLE_NOT_ACCEPTED: 'CYCLE_NOT_ACCEPTED',
  ORDER_SET_MISMATCH: 'ORDER_SET_MISMATCH',
  QUANTITY_PER_OFFER_MISMATCH: 'QUANTITY_PER_OFFER_MISMATCH',
  PRICE_PER_UNIT_CHANGED: 'PRICE_PER_UNIT_CHANGED',
  KU_GROUPS_OVERLAP: 'KU_GROUPS_OVERLAP',
  EMPTY_GROUPS: 'EMPTY_GROUPS',
  UNKNOWN_ORDER: 'UNKNOWN_ORDER',
  NON_OFFERER_ACCOUNT: 'NON_OFFERER_ACCOUNT',
} as const satisfies Record<string, MarketplaceSupplyValidationReason>;

export interface MarketplaceSupplyValidationLogProps {
  id: string;
  coopname: string;
  cycle_id: string;
  offerer_account: string;
  outcome: MarketplaceSupplyValidationOutcome;
  /** Текстовый детализированный reason (для UI: «Состав поставки не соответствует акцептованной заявке: <reason>»). */
  reason: string | null;
  reason_code: MarketplaceSupplyValidationReason | null;
  /** Снапшот payload'а попытки (полная группировка). Для аудита. */
  attempted_groups: unknown;
  created_at: Date;
}
