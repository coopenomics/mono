/**
 * Изображения оферты Стола заказов → плоский список URL'ов с обложкой первой.
 *
 * Единый порядок для карусели в карточке на всех экранах (каталог, модерация,
 * мои предложения): сначала обложка (`is_cover`), далее — по `sort_order`.
 * Принимает «утиную» форму, чтобы одинаково работать с Zeus-выводами разных
 * marketplace-операций (тип поля `images` у них структурно совпадает).
 */
export interface MarketplaceOfferImageLike {
  url: string;
  is_cover?: boolean | null;
  sort_order?: number | null;
}

export function marketplaceOfferImageUrls(
  images: readonly MarketplaceOfferImageLike[] | null | undefined,
): string[] {
  if (!images?.length) return [];
  return [...images]
    .sort(
      (a, b) =>
        Number(b.is_cover) - Number(a.is_cover) || (a.sort_order ?? 0) - (b.sort_order ?? 0),
    )
    .map((img) => img.url);
}
