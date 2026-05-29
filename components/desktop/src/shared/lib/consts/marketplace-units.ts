/**
 * Единицы измерения товара Стола заказов — единый источник для всех
 * marketplace-экранов (создание оферты, модерация, мои предложения, каталог).
 *
 * Канон-значения (`piece`/`kg`/`liter`/`pack`) совпадают с backend-enum
 * `unit_of_measure`. Русские подписи держим здесь, чтобы «liter» не утекало в
 * UI на английском и подписи не расходились между страницами (раньше карта
 * дублировалась в ChairmanModeration и в CreateMarketplaceOffer).
 */
export type MarketplaceUnitOfMeasure = 'piece' | 'kg' | 'liter' | 'pack';

interface MarketplaceUnitDef {
  value: MarketplaceUnitOfMeasure;
  /** Полная подпись для селекта при создании оферты. */
  label: string;
  /** Короткая подпись для карточек и мета-строк (цена/остаток). */
  short: string;
}

const MARKETPLACE_UNITS: readonly MarketplaceUnitDef[] = [
  { value: 'piece', label: 'шт.', short: 'шт' },
  { value: 'kg', label: 'кг', short: 'кг' },
  { value: 'liter', label: 'литр', short: 'л' },
  { value: 'pack', label: 'упак.', short: 'упак' },
];

/** Опции для q-select при создании/редактировании оферты. */
export const MARKETPLACE_UNIT_OPTIONS: Array<{ label: string; value: MarketplaceUnitOfMeasure }> =
  MARKETPLACE_UNITS.map(({ label, value }) => ({ label, value }));

/**
 * Короткая русская подпись единицы для карточек/мета. Принимает строку (а не
 * строгий union), чтобы одинаково работать со значениями из Zeus-enum'ов
 * разных операций. Неизвестное значение возвращается как есть — лучше показать
 * исходное, чем потерять.
 */
export function marketplaceUnitShort(value: string | null | undefined): string {
  if (!value) return 'ед.';
  return MARKETPLACE_UNITS.find((u) => u.value === value)?.short ?? value;
}

/** Полная русская подпись единицы (для подробных экранов). */
export function marketplaceUnitLabel(value: string | null | undefined): string {
  if (!value) return 'ед.';
  return MARKETPLACE_UNITS.find((u) => u.value === value)?.label ?? value;
}
