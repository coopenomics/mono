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

/** Убирает хвостовые нули количества: 1.000 → «1», 0.500 → «0.5». */
function trimNumber(n: number): string {
  return String(Number(n.toFixed(3)));
}

/**
 * Подпись базовой единицы измерения (Эпик 17): количество ведётся прямо в
 * базовой единице (кг/л/шт), поэтому ярлык — сама единица. Понятие «фасовки»
 * упразднено; необязательный второй аргумент игнорируется (обратная
 * совместимость вызовов).
 */
export function marketplaceOrderUnitLabel(
  unit: string | null | undefined,
  _size?: string | number | null | undefined,
): string {
  return marketplaceUnitShort(unit);
}

/**
 * Кол-во + базовая единица: «0.5 кг», «20 кг», «3 шт». Количество дробное в
 * базовой единице; необязательный третий аргумент игнорируется (обратная
 * совместимость вызовов).
 */
export function marketplaceQuantityLabel(
  quantity: number | string | null | undefined,
  unit: string | null | undefined,
  _size?: string | number | null | undefined,
): string {
  const parsed = typeof quantity === 'string' ? Number.parseFloat(quantity) : quantity ?? 0;
  const q = Number.isFinite(parsed as number) ? (parsed as number) : 0;
  return `${trimNumber(q)} ${marketplaceUnitShort(unit)}`;
}
