/**
 * Стоимость строки имущества — единственная формула суммы на десктопе.
 *
 * Канон единицы отпуска (Эпик 18): количество везде хранится в базовой
 * единице (штуки/килограммы/литры), а цена задана за ЕДИНИЦУ ОТПУСКА — за
 * базовую единицу при отпуске по мере и за упаковку при отпуске упаковкой.
 * Поэтому «количество × цена» верно только для отпуска по мере: при упаковке
 * сначала считается число упаковок.
 *
 * Зеркалит `calcCostMinor` контроллера
 * (`controller/.../application/shared/cost.util.ts`) и `Marketplace::calc_cost`
 * контракта — там же source of truth. Считать сумму строки где-то ещё, «на
 * месте», запрещено: именно россыпь ручных умножений завышала суммы приёмки,
 * выдачи и ТТН ровно в размер упаковки (инцидент 2026-08-12 — десяток яиц по
 * 150 ₽ показывался как 1500 ₽).
 */

/** Число единиц отпуска в базовом количестве: упаковок либо базовых единиц. */
export function marketplaceSaleUnits(
  quantity: number | string | null | undefined,
  packageSize: number | null | undefined,
): number {
  const qty = toNumber(quantity);
  if (packageSize && packageSize > 0) {
    return Math.round(qty / packageSize);
  }
  return qty;
}

/**
 * Стоимость строки: число единиц отпуска × цена за единицу отпуска.
 * Нечитаемая цена (null, пустая строка, мусор) трактуется как ноль — строка
 * без цены показывает 0, а не NaN.
 */
export function marketplaceLineCost(
  quantity: number | string | null | undefined,
  unitPrice: number | string | null | undefined,
  packageSize: number | null | undefined,
): number {
  const price = toNumber(unitPrice);
  if (!Number.isFinite(price)) return 0;
  return marketplaceSaleUnits(quantity, packageSize) * price;
}

/** То же, но строкой машинной точности (4 знака) — для полей и сумм в DTO. */
export function marketplaceLineCostAmount(
  quantity: number | string | null | undefined,
  unitPrice: number | string | null | undefined,
  packageSize: number | null | undefined,
): string {
  return marketplaceLineCost(quantity, unitPrice, packageSize).toFixed(4);
}

function toNumber(value: number | string | null | undefined): number {
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value !== 'string') return 0;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : 0;
}
