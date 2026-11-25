import {
  marketplaceAvailablePackages,
  offerCardUnitCost,
  offerCardUnitLabel,
} from 'src/shared/lib/marketplace';
import { marketplaceOfferImageUrls } from 'src/shared/lib/utils';
import type { CatalogOffer, CatalogOfferStatus } from 'src/widgets/Marketplace/CatalogOfferCard';
import type { MarketplaceOfferView } from '../types';

/**
 * Предложение каталога в виде карточки. Одно правило на все экраны заказчика,
 * где предложения стоят карточками: каталог и страница поставщика.
 */
export function toCatalogOffer(
  offer: MarketplaceOfferView,
  categoryNameById: Record<number, string>,
): CatalogOffer {
  // Заказчику показываем только ту тару, которую он может взять: пустая
  // упаковка в карточке обещает товар, а в окне «В корзину» упирается в
  // «Доступно: 0». Крупная цена тоже считается по доступной таре — иначе
  // карточка называет цену литровой бутылки, которой на складе нет.
  const availableOffer = {
    ...offer,
    packages: marketplaceAvailablePackages(offer.packages, offer.unlimited_flag),
  };
  return {
    id: offer.id,
    title: offer.product_name,
    description: offer.description ?? undefined,
    images: marketplaceOfferImageUrls(offer.images),
    remainUnits: remainUnits(offer, availableOffer.packages),
    unitCost: offerCardUnitCost(availableOffer),
    unitLabel: offerCardUnitLabel(availableOffer),
    status: catalogStatus(offer),
    category: categoryNameById[offer.category_id],
    ...supplierOf(offer),
    ratingAvg: offer.rating_avg ?? null,
    reviewsCount: offer.reviews_count,
  };
}

function catalogStatus(offer: MarketplaceOfferView): CatalogOfferStatus {
  return !offer.unlimited_flag && offer.quantity_available <= 0 ? 'sold-out' : 'published';
}

/**
 * Остаток на карточке. Основная доступная тара задаёт и цену, и остаток:
 * карточка говорит «130 ₽ за упак. 0,5 л — 90 упак.», а весь перечень тары
 * заказчик выбирает в окне «В корзину» или на странице предложения (решение
 * владельца 14.09.2026). Без ограничения остатка числа нет.
 */
function remainUnits(
  offer: MarketplaceOfferView,
  availablePackages: Array<{ is_default?: boolean | null; quantity_available: number }>,
): number | undefined {
  if (offer.unlimited_flag) return undefined;
  const mainPackage = availablePackages.find((p) => p.is_default) ?? availablePackages[0];
  return mainPackage ? mainPackage.quantity_available : offer.quantity_available;
}

/** Кто поставляет: поставщик либо кооператив со своего склада (requirement 76). */
function supplierOf(
  offer: MarketplaceOfferView,
): Pick<CatalogOffer, 'supplierName' | 'supplierAccount' | 'coopStock'> {
  return {
    supplierName: offer.supplier_name ?? undefined,
    supplierAccount: offer.supplier_account,
    coopStock: Boolean(offer.stock_braname),
  };
}

/** Можно ли положить предложение в корзину: есть свободный остаток либо тара. */
export function canOrderOffer(offer: MarketplaceOfferView): boolean {
  if (offer.unlimited_flag) return true;
  if (offer.quantity_available <= 0) return false;
  // Отпуск упаковкой: остаток ведётся на каждой таре, и общий котёл литров
  // ничего не решает — если свободных упаковок нет, заказывать нечего.
  if (offer.packages?.length) {
    return marketplaceAvailablePackages(offer.packages, false).length > 0;
  }
  return true;
}
