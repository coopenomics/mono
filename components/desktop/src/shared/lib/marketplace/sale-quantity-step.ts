import { MarketplaceSaleForm, MarketplaceUnitOfMeasure } from 'src/shared/lib/consts';

/** Минимально необходимый набор полей оффера для расчёта шага количества (Эпик 18). */
export interface SaleQuantityOffer {
  sale_form?: MarketplaceSaleForm | null;
  unit_of_measure?: MarketplaceUnitOfMeasure | string | null;
}

/**
 * Шаг степпера количества: упаковкой и штучным товаром — только целое число
 * (нельзя докинуть 0.5 упаковки/штуки), по мере (кг/л) — дробное до 0.001.
 */
export function saleQuantityStep(offer: SaleQuantityOffer | null | undefined): number {
  if (offer?.sale_form === MarketplaceSaleForm.PACKAGED) return 1;
  return offer?.unit_of_measure === MarketplaceUnitOfMeasure.PIECE ? 1 : 0.001;
}

/** Округление значения степпера к шагу — без плавающего мусора вроде «1.0001». */
export function quantizeSaleQuantity(offer: SaleQuantityOffer | null | undefined, value: number): number {
  return saleQuantityStep(offer) === 1 ? Math.floor(value) : Math.round(value * 1000) / 1000;
}
