import { BadRequestException } from '@nestjs/common';
import {
  MarketplaceSaleForms,
  type MarketplaceOfferPackage,
  type MarketplaceSaleForm,
  type MarketplaceUnitOfMeasure,
} from '../../domain/entities/marketplace-offer.types';
import { assertValidQuantity, MARKETPLACE_UNIT_PRECISION } from './quantity.util';
import { marketplaceOrderUnitLabel } from './unit-label.util';

/**
 * Разрешение способа отпуска оффера (Эпик 18) в величины заказа и цепи.
 *
 * По мере (`by_measure`): заказывают базовое количество; цена — за базовую
 * единицу; упаковки нет (`packageSize = 0`).
 *
 * Упаковкой (`packaged`): заказывают целое число упаковок выбранного варианта;
 * базовое количество = число упаковок × содержимое; цена единицы отпуска — за
 * упаковку. Кратность упаковке на цепи гарантирует именно это произведение,
 * поэтому копейка стоимости не округляется (см. контракт `calc_cost`).
 *
 * КАНОН ЕДИНИЦЫ ОТПУСКА (полностью — в README расширения, раздел «Единица
 * отпуска»): упаковка неделима. Имущество принимают, выдают, возвращают и
 * списывают целыми упаковками; брак внутри упаковки отражается ЦЕНОЙ, а не
 * пересчётом штук. Отсюда: цена везде задана за единицу отпуска, количество
 * хранится в базовой единице и кратно упаковке, а сумма считается ТОЛЬКО
 * через `calcCostAmount`/`calcCostMinor` — ручное «количество × цена»
 * завышает её ровно в размер упаковки.
 */
export interface ResolvedSaleUnit {
  /** Количество в базовой единице (кг/л/шт): для counters, quantity_available, on-chain asset. */
  baseQuantity: number;
  /** Цена за единицу отпуска (numeric-строка): за базовую единицу | за упаковку. */
  unitPrice: string;
  /** Содержимое упаковки в базовой единице; 0 = отпуск по мере. */
  packageSize: number;
  /** Выбранная упаковка каталога (для денормализации в заказ); null = по мере. */
  packageId: string | null;
  /** Число упаковок в заказе; null = по мере. */
  packageCount: number | null;
}

/** Найти упаковку каталога по id или бросить читаемую ошибку. */
export function findOfferPackageOrFail(
  packages: MarketplaceOfferPackage[] | null | undefined,
  packageId: string | null | undefined
): MarketplaceOfferPackage {
  if (!packageId) {
    throw new BadRequestException('Для товара, отпускаемого упаковкой, нужно выбрать упаковку.');
  }
  const pkg = (packages ?? []).find((p) => p.id === packageId);
  if (!pkg) {
    throw new BadRequestException('Выбранная упаковка не найдена в предложении.');
  }
  return pkg;
}

/**
 * @param requestedAmount — базовое количество при `by_measure`, число упаковок
 *   при `packaged` (целое ≥ 1).
 */
export function resolveSaleUnit(
  offer: {
    sale_form: MarketplaceSaleForm;
    packages: MarketplaceOfferPackage[] | null;
    price_per_unit: string;
    unit_of_measure: MarketplaceUnitOfMeasure;
  },
  requestedAmount: number,
  packageId: string | null | undefined
): ResolvedSaleUnit {
  if (offer.sale_form === MarketplaceSaleForms.PACKAGED) {
    const pkg = findOfferPackageOrFail(offer.packages, packageId);
    if (!Number.isInteger(requestedAmount) || requestedAmount <= 0) {
      throw new BadRequestException('Число упаковок должно быть целым и больше нуля.');
    }
    const precision = MARKETPLACE_UNIT_PRECISION[offer.unit_of_measure];
    const baseQuantity = Number((requestedAmount * pkg.size).toFixed(precision));
    assertValidQuantity(baseQuantity, offer.unit_of_measure);
    return {
      baseQuantity,
      unitPrice: pkg.price,
      packageSize: pkg.size,
      packageId: pkg.id,
      packageCount: requestedAmount,
    };
  }

  // Отпуск по мере
  assertValidQuantity(requestedAmount, offer.unit_of_measure);
  return {
    baseQuantity: requestedAmount,
    unitPrice: offer.price_per_unit,
    packageSize: 0,
    packageId: null,
    packageCount: null,
  };
}

/**
 * Презентация единицы отпуска и количества для акта/UI (Эпик 18):
 *  - по мере: `{ units: "1.5", unitLabel: "кг" }` — цена за «кг»;
 *  - упаковкой: `{ units: "3", unitLabel: "упак. 0,5 л" }` — цена за упаковку.
 * Так акт (factory 1104/1105) читается без домыслов: units × unit_cost = сумма.
 */
export function presentSaleUnit(
  baseQuantity: number,
  unit: MarketplaceUnitOfMeasure,
  packageSize: number
): { units: number; unitLabel: string } {
  const baseLabel = marketplaceOrderUnitLabel(unit);
  if (packageSize > 0) {
    return {
      units: Number((baseQuantity / packageSize).toFixed(0)),
      unitLabel: `упак. ${formatSize(packageSize)} ${baseLabel}`,
    };
  }
  return { units: baseQuantity, unitLabel: baseLabel };
}

/** Компактная десятичная запись размера упаковки для подписи (0.5 → «0,5»). */
function formatSize(size: number): string {
  return String(size).replace('.', ',');
}
