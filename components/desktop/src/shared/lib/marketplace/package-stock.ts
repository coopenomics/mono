import { marketplaceOrderUnitLabel } from 'src/shared/lib/consts/marketplace-units';

/** Упаковка предложения в той части, что нужна подписи остатка. */
export interface PackageStockLike {
  size: number;
  label?: string | null;
  quantity_available: number;
}

/**
 * Подпись остатка по упаковкам: «3 упак. 0,5 л · 8 упак. 1 л». Остаток при
 * отпуске упаковкой ведётся на каждой упаковке, поэтому одно число в базовых
 * единицах заказчику ни о чём не говорит — бутылок нужного объёма может не
 * быть при полном котле литров.
 */
export function marketplacePackageStockLabel(
  packages: ReadonlyArray<PackageStockLike>,
  unit: string | null | undefined,
): string {
  const unitLabel = marketplaceOrderUnitLabel(unit);
  return packages
    .map((p) => `${p.quantity_available} упак. ${String(p.size).replace('.', ',')} ${unitLabel}`)
    .join(' · ');
}

/** Сумма свободных упаковок — для проверки «есть ли что заказать». */
export function marketplacePackagesAvailable(packages: ReadonlyArray<PackageStockLike>): number {
  return packages.reduce((sum, p) => sum + (p.quantity_available ?? 0), 0);
}
