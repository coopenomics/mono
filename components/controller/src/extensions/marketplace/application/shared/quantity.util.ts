import { BadRequestException } from '@nestjs/common';
import {
  MarketplaceUnitsOfMeasure,
  type MarketplaceUnitOfMeasure,
} from '../../domain/entities/marketplace-offer.types';

/**
 * Количество имущества (Эпик 17, L14): в API/БД контроллера — «витринное»
 * дробное число в базовой единице (0.5 = 0.5 кг), на цепи — `eosio::asset` с
 * символом единицы и фиксированной точностью (KG/LTR precision 3 = граммы/мл,
 * PCS precision 0 = штука неделима). Здесь — единый источник символа/точности
 * единицы и конвертация витринного числа ↔ asset-строки.
 *
 * Точность — производная от `unit_of_measure`, отдельного поля нет: символ и
 * точность едут вместе с asset'ом, дискретность штук выражена precision 0.
 */
export const MARKETPLACE_UNIT_SYMBOL: Record<MarketplaceUnitOfMeasure, string> = {
  [MarketplaceUnitsOfMeasure.PIECE]: 'PCS',
  [MarketplaceUnitsOfMeasure.KG]: 'KG',
  [MarketplaceUnitsOfMeasure.LITER]: 'LTR',
};

export const MARKETPLACE_UNIT_PRECISION: Record<MarketplaceUnitOfMeasure, number> = {
  [MarketplaceUnitsOfMeasure.PIECE]: 0,
  [MarketplaceUnitsOfMeasure.KG]: 3,
  [MarketplaceUnitsOfMeasure.LITER]: 3,
};

/**
 * Допуск при сравнении количеств. Самая мелкая значимая доля — грамм и
 * миллилитр (точность 3), поэтому расхождение меньше этого порога означает
 * ошибку двоичной дроби, а не реальную разницу в имуществе.
 */
export const MARKETPLACE_QUANTITY_EPSILON = 1e-6;

/** Витринное количество (0.5) + единица → on-chain asset-строка «0.500 KG». */
export function toQuantityAsset(displayQty: number, unit: MarketplaceUnitOfMeasure): string {
  const precision = MARKETPLACE_UNIT_PRECISION[unit];
  const symbol = MARKETPLACE_UNIT_SYMBOL[unit];
  return `${displayQty.toFixed(precision)} ${symbol}`;
}

/** on-chain asset-строка «0.500 KG» → витринное число 0.5. */
export function fromQuantityAsset(quantityAsset: string): number {
  const [amountPart] = quantityAsset.trim().split(/\s+/);
  const parsed = Number.parseFloat(amountPart);
  if (!Number.isFinite(parsed)) {
    throw new BadRequestException(`Некорректное количество (asset): "${quantityAsset}"`);
  }
  return parsed;
}

/**
 * Валидация витринного количества под единицу: положительное; штука (piece)
 * неделима (только целое); вес/объём допускают дробное с точностью единицы.
 */
export function assertValidQuantity(displayQty: number, unit: MarketplaceUnitOfMeasure): void {
  if (!Number.isFinite(displayQty) || displayQty <= 0) {
    throw new BadRequestException('Количество должно быть больше нуля.');
  }
  if (unit === MarketplaceUnitsOfMeasure.PIECE && !Number.isInteger(displayQty)) {
    throw new BadRequestException('Количество в штуках должно быть целым.');
  }
  const precision = MARKETPLACE_UNIT_PRECISION[unit];
  const scaled = displayQty * 10 ** precision;
  if (Math.abs(scaled - Math.round(scaled)) > 1e-9) {
    throw new BadRequestException(
      `Количество для единицы «${unit}» допускает не более ${precision} знаков после запятой.`
    );
  }
}
