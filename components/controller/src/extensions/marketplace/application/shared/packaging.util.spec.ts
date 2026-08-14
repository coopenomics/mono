import { BadRequestException } from '@nestjs/common';
import { findOfferPackageOrFail, presentSaleUnit, resolveSaleUnit } from './packaging.util';
import { MarketplaceSaleForms, MarketplaceUnitsOfMeasure } from '../../domain/entities/marketplace-offer.types';
import type { MarketplaceOfferPackage } from '../../domain/entities/marketplace-offer.types';

/**
 * Инцидент 2026-07-25: заказ 10 упаковок по 0,1 л при цене 100 ₽/упаковку
 * списал с кошелька 100 ₽ вместо 1000 ₽. Причина оказалась не в этой
 * математике (она верна), а в том, что задеплоенный на dev-цепь контракт был
 * старой сборкой без `package_size` — но тест на саму формулу отсутствовал,
 * поэтому регресс здесь не поймали бы раньше времени. Эти тесты фиксируют
 * именно денежный инвариант: стоимость упаковочного заказа считается через
 * число упаковок (`packageCount × цена упаковки`), а не через базовое
 * количество (`baseQuantity × цена упаковки`), которое даёт на порядок
 * меньшую (или большую) сумму.
 */
describe('packaging.util — resolveSaleUnit / presentSaleUnit', () => {
  const milkPackage: MarketplaceOfferPackage = {
    id: 'pkg-0.1l',
    size: 0.1,
    price: '100.0000',
    label: null,
    package_type: 'пластиковая бутылка',
    sort_order: 0,
    is_default: true,
  };

  const packagedOffer = {
    sale_form: MarketplaceSaleForms.PACKAGED,
    packages: [milkPackage],
    price_per_unit: '999.0000', // отпуск по мере недоступен для этого оффера — цена не должна использоваться
    unit_of_measure: MarketplaceUnitsOfMeasure.LITER,
  };

  const byMeasureOffer = {
    sale_form: MarketplaceSaleForms.BY_MEASURE,
    packages: null,
    price_per_unit: '250.0000',
    unit_of_measure: MarketplaceUnitsOfMeasure.KG,
  };

  it('упаковкой: 10 упаковок по 0,1 л → базовое количество 1 л, цена упаковки, НЕ базовой единицы', () => {
    const resolved = resolveSaleUnit(packagedOffer, 10, milkPackage.id);
    expect(resolved.baseQuantity).toBe(1);
    expect(resolved.unitPrice).toBe('100.0000');
    expect(resolved.packageSize).toBe(0.1);
    expect(resolved.packageCount).toBe(10);
  });

  it('денежный инвариант: итог за упаковочный заказ считается по числу упаковок, а не по baseQuantity', () => {
    const resolved = resolveSaleUnit(packagedOffer, 10, milkPackage.id);
    const correctTotal = resolved.packageCount! * Number.parseFloat(resolved.unitPrice);
    const buggyTotal = resolved.baseQuantity * Number.parseFloat(resolved.unitPrice);
    expect(correctTotal).toBe(1000);
    // Ровно тот баг, который списал 100 ₽ вместо 1000 ₽: baseQuantity(1) × цена
    // упаковки(100) — соблазнительно выглядит как валидная формула, но даёт
    // сумму в 10 раз меньше. Явно фиксируем, что это НЕ ожидаемое значение.
    expect(buggyTotal).not.toBe(correctTotal);
    expect(buggyTotal).toBe(100);
  });

  it('по мере: baseQuantity = запрошенное количество, цена — offer.price_per_unit, упаковка отсутствует', () => {
    const resolved = resolveSaleUnit(byMeasureOffer, 2.5, null);
    expect(resolved.baseQuantity).toBe(2.5);
    expect(resolved.unitPrice).toBe('250.0000');
    expect(resolved.packageSize).toBe(0);
    expect(resolved.packageId).toBeNull();
    expect(resolved.packageCount).toBeNull();
  });

  it('упаковкой: дробное или нулевое число упаковок отклоняется', () => {
    expect(() => resolveSaleUnit(packagedOffer, 1.5, milkPackage.id)).toThrow(BadRequestException);
    expect(() => resolveSaleUnit(packagedOffer, 0, milkPackage.id)).toThrow(BadRequestException);
  });

  it('упаковкой: без выбранной упаковки — читаемая ошибка, не тихий fallback на «по мере»', () => {
    expect(() => resolveSaleUnit(packagedOffer, 10, null)).toThrow(BadRequestException);
    expect(() => resolveSaleUnit(packagedOffer, 10, 'unknown-id')).toThrow(BadRequestException);
  });

  it('presentSaleUnit: обратная презентация — базовое количество → число упаковок + подпись размера', () => {
    expect(presentSaleUnit(1, MarketplaceUnitsOfMeasure.LITER, 0.1)).toEqual({
      units: 10,
      unitLabel: 'упак. 0,1 л',
    });
  });

  it('presentSaleUnit: по мере (packageSize=0) — количество и единица как есть', () => {
    expect(presentSaleUnit(2.5, MarketplaceUnitsOfMeasure.KG, 0)).toEqual({
      units: 2.5,
      unitLabel: 'кг',
    });
  });

  it('presentSaleUnit — round-trip с resolveSaleUnit: сколько упаковок заказали, столько и презентуется обратно', () => {
    const resolved = resolveSaleUnit(packagedOffer, 10, milkPackage.id);
    const presented = presentSaleUnit(resolved.baseQuantity, packagedOffer.unit_of_measure, resolved.packageSize);
    expect(presented.units).toBe(10);
  });
});

describe('packaging.util — findOfferPackageOrFail', () => {
  const pkg: MarketplaceOfferPackage = {
    id: 'pkg-1',
    size: 0.5,
    price: '500.0000',
    label: 'полкилошка',
    sort_order: 0,
    is_default: true,
  };

  it('находит упаковку по id', () => {
    expect(findOfferPackageOrFail([pkg], 'pkg-1')).toBe(pkg);
  });

  it('без packageId — читаемая ошибка', () => {
    expect(() => findOfferPackageOrFail([pkg], null)).toThrow(BadRequestException);
    expect(() => findOfferPackageOrFail([pkg], undefined)).toThrow(BadRequestException);
  });

  it('с несуществующим packageId или пустым каталогом — читаемая ошибка', () => {
    expect(() => findOfferPackageOrFail([pkg], 'nope')).toThrow(BadRequestException);
    expect(() => findOfferPackageOrFail(null, 'pkg-1')).toThrow(BadRequestException);
    expect(() => findOfferPackageOrFail(undefined, 'pkg-1')).toThrow(BadRequestException);
  });
});
