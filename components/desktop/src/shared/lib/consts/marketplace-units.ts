/**
 * Единицы измерения товара Стола заказов — единый источник для всех
 * marketplace-экранов (создание оферты, модерация, мои предложения, каталог).
 *
 * Канон-значения (`piece`/`kg`/`liter`) совпадают с backend-enum
 * `unit_of_measure` — это БАЗОВАЯ единица измерения. «Упаковка» единицей не
 * является: заказ упаковками/фасовками задаётся размером единицы заказа
 * (`order_unit_size`), например `piece` + 8 = упаковка из 8 штук. Русские
 * подписи держим здесь, чтобы «liter» не утекало в UI на английском и подписи
 * не расходились между страницами (раньше карта дублировалась в
 * ChairmanModeration и в CreateMarketplaceOffer).
 */
export type MarketplaceUnitOfMeasure = 'piece' | 'kg' | 'liter';

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

/**
 * Пресеты размера единицы заказа (фасовки) по базовой единице — фиксированный
 * выбор в форме публикации. На backend `order_unit_size` допускает любое
 * положительное число, но заказчику/поставщику показываем типовые варианты.
 * Значения — в базовых единицах (kg/liter/piece), как строки numeric.
 */
export const MARKETPLACE_ORDER_UNIT_PRESETS: Record<MarketplaceUnitOfMeasure, readonly string[]> = {
  kg: ['0.1', '0.25', '0.5', '1', '2', '5'],
  liter: ['0.25', '0.5', '1', '1.5', '2', '5'],
  piece: ['1', '6', '8', '10', '12', '30'],
};

/** Убирает хвостовые нули у числа-фасовки: 1.000 → «1», 0.100 → «0.1». */
function trimNumber(n: number): string {
  return String(Number(n.toFixed(3)));
}

/**
 * Человекочитаемая подпись одной единицы заказа (фасовки) — объём, которым
 * оперирует заказчик. Примеры: kg+0.1 → «100 г», kg+1 → «1 кг»,
 * liter+0.5 → «500 мл», piece+8 → «упаковка 8 шт», piece+1 → «шт».
 */
export function marketplaceOrderUnitLabel(
  unit: string | null | undefined,
  size: string | number | null | undefined,
): string {
  const parsed = typeof size === 'string' ? Number.parseFloat(size) : size ?? 1;
  const q = Number.isFinite(parsed) && (parsed as number) > 0 ? (parsed as number) : 1;
  if (unit === 'kg') return q < 1 ? `${Math.round(q * 1000)} г` : `${trimNumber(q)} кг`;
  if (unit === 'liter') return q < 1 ? `${Math.round(q * 1000)} мл` : `${trimNumber(q)} л`;
  // piece
  if (q === 1) return 'шт';
  return `упаковка ${trimNumber(q)} шт`;
}
