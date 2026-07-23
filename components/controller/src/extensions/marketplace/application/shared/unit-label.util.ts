/** Убирает хвостовые нули у размера фасовки: 1.000 → «1», 0.100 → «0.1». */
function trimNumber(n: number): string {
  return String(Number(n.toFixed(3)));
}

/**
 * Человекочитаемая подпись ОДНОЙ единицы заказа (фасовки) — того объёма, в
 * котором заказчик заказывает, а акт АПП фиксирует переданное. Заказ и акт
 * ведутся в этих единицах БЕЗ пересчёта в базовые: 2 упаковки так и остаются
 * «2 упаковки», а не «16 шт». `order_unit_size` задаёт только смысл ярлыка.
 *
 * Примеры: kg+0.1 → «100 г», kg+1 → «1 кг», liter+0.5 → «500 мл»,
 * piece+8 → «упаковка 8 шт», piece+1 → «шт». Зеркало фронтового
 * `marketplaceOrderUnitLabel` (components/desktop/.../consts/marketplace-units.ts).
 */
export function marketplaceOrderUnitLabel(
  unit: string | null | undefined,
  size: string | number | null | undefined
): string {
  const parsed = typeof size === 'string' ? Number.parseFloat(size) : size ?? 1;
  const q = Number.isFinite(parsed) && (parsed as number) > 0 ? (parsed as number) : 1;
  if (unit === 'kg') return q < 1 ? `${Math.round(q * 1000)} г` : `${trimNumber(q)} кг`;
  if (unit === 'liter') return q < 1 ? `${Math.round(q * 1000)} мл` : `${trimNumber(q)} л`;
  // piece
  if (q === 1) return 'шт';
  return `упаковка ${trimNumber(q)} шт`;
}
