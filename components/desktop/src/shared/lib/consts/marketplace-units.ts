import { Zeus } from '@coopenomics/sdk';

/**
 * Единицы измерения и способ отпуска товара Стола заказов — единый источник
 * для всех marketplace-экранов (создание оферты, модерация, мои предложения,
 * каталог, корзина, заказы).
 *
 * Значения — РЕАЛЬНЫЕ GraphQL-enum'ы из Zeus (`Zeus.MarketplaceUnitOfMeasure`,
 * `Zeus.MarketplaceSaleForm`), а не собственные строки: сервер сериализует
 * enum именем варианта (`KG`, `PACKAGED`), а не JS-значением backend'а
 * (`kg`, `packaged`) — свой строковый union здесь расходится с проводом и
 * ловится либо ошибкой валидации на mutation, либо молчаливым непопаданием
 * сравнения на чтении. Базовая единица (кг/л/шт) — отдельная характеристика
 * от способа отпуска (по мере/упаковкой, Эпик 18); «упаковка» сама по себе
 * не единица измерения. Русские подписи держим здесь, чтобы не расходились
 * между страницами.
 */
export const MarketplaceUnitOfMeasure = Zeus.MarketplaceUnitOfMeasure;
export type MarketplaceUnitOfMeasure = Zeus.MarketplaceUnitOfMeasure;

export const MarketplaceSaleForm = Zeus.MarketplaceSaleForm;
export type MarketplaceSaleForm = Zeus.MarketplaceSaleForm;

interface MarketplaceUnitDef {
  value: MarketplaceUnitOfMeasure;
  /** Полная подпись для селекта при создании оферты. */
  label: string;
  /** Короткая подпись для карточек и мета-строк (цена/остаток). */
  short: string;
}

const MARKETPLACE_UNITS: readonly MarketplaceUnitDef[] = [
  { value: MarketplaceUnitOfMeasure.PIECE, label: 'шт.', short: 'шт' },
  { value: MarketplaceUnitOfMeasure.KG, label: 'кг', short: 'кг' },
  { value: MarketplaceUnitOfMeasure.LITER, label: 'литр', short: 'л' },
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
