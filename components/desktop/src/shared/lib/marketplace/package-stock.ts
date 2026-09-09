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

/** Упаковка предложения в том виде, в каком её отдаёт бэкенд. */
export interface OfferPackageLike {
  id: string;
  size: number;
  price: string;
  package_type?: string | null;
  quantity_available: number;
}

/**
 * Упаковки предложения → строки карточки каталога: подпись «1 л, стекло», цена
 * за упаковку и остаток в упаковках. Одна и та же раскладка нужна каталогу,
 * модерации и столу поставщика — иначе один и тот же товар выглядит в трёх
 * местах по-разному.
 */
export function marketplaceCardPackages(
  packages: ReadonlyArray<OfferPackageLike> | null | undefined,
  unit: string | null | undefined,
  unlimited: boolean,
): Array<{ id: string; label: string; price: string; remain: number | null }> {
  const unitLabel = marketplaceOrderUnitLabel(unit);
  return (packages ?? []).map((p) => ({
    id: p.id,
    label: [`${String(p.size).replace('.', ',')} ${unitLabel}`, p.package_type]
      .filter(Boolean)
      .join(', '),
    price: p.price,
    remain: unlimited ? null : p.quantity_available,
  }));
}

/** Предложение в той части, что нужна карточке каталога. */
export interface OfferCardSource {
  sale_form?: string | null;
  price_per_unit: string;
  unit_of_measure?: string | null;
  packages?: ReadonlyArray<OfferPackageLike> | null;
}

/** Основная упаковка предложения: её цену заказчик видит первой. */
function defaultPackage(offer: OfferCardSource): OfferPackageLike | null {
  const packages = offer.packages ?? [];
  if (!packages.length) return null;
  return packages.find((p) => (p as { is_default?: boolean }).is_default) ?? packages[0];
}

/**
 * Крупная цена карточки — за единицу отпуска: при отпуске упаковкой это цена
 * основной упаковки, а не выведенная цена за литр. Иначе карточка обещает
 * «130 ₽ за литр», а в корзине заказчик видит цену упаковки.
 */
export function offerCardUnitCost(offer: OfferCardSource): number {
  const pkg = defaultPackage(offer);
  const raw = pkg ? pkg.price : offer.price_per_unit;
  return Number.parseFloat(raw) || 0;
}

/** Подпись единицы отпуска: «л» по мере, «упак. 1 л» при отпуске упаковкой. */
export function offerCardUnitLabel(offer: OfferCardSource): string {
  const unitLabel = marketplaceOrderUnitLabel(offer.unit_of_measure);
  const pkg = defaultPackage(offer);
  return pkg ? `упак. ${String(pkg.size).replace('.', ',')} ${unitLabel}` : unitLabel;
}
