import type { MarketplaceUnitOfMeasure } from '../../domain/entities/marketplace-offer.types';

/**
 * Человекочитаемые единицы измерения для документов marketplace (АПП приёмки,
 * акт выдачи). Используется при сборке Action 1102 в обоих сервисах — приёмки и
 * выдачи, поэтому вынесено в shared (DRY).
 */
export const MARKETPLACE_UNIT_LABEL: Record<MarketplaceUnitOfMeasure, string> = {
  piece: 'шт.',
  kg: 'кг',
  liter: 'л',
};
