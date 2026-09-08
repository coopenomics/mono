import { BadRequestException } from '@nestjs/common';
import {
  adjustPackagesBySize,
  findOfferPackageOrFail,
  packageDeltaOfOrder,
  packagedBaseQuantity,
  presentSaleUnit,
  releasePackagesForPositions,
  resolveSaleUnit,
  saleUnitShortfall,
} from './packaging.util';
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
    quantity_available: 20,
    quantity_blocked: 0,
    quantity_consumed: 0,
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
    package_type: 'пластиковая бутылка',
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

/**
 * Остаток по упаковкам (решение владельца 08.09.2026): нехватка считается по
 * заказанной упаковке, а не по котлу базовых единиц; счётчики предложения —
 * сумма по упаковкам.
 */
describe('packaging.util — остаток по упаковкам', () => {
  const half: MarketplaceOfferPackage = {
    id: 'pkg-0.5',
    size: 0.5,
    price: '70.0000',
    label: null,
    package_type: 'стекло',
    sort_order: 0,
    is_default: true,
    quantity_available: 3,
    quantity_blocked: 1,
    quantity_consumed: 0,
  };
  const litre: MarketplaceOfferPackage = { ...half, id: 'pkg-1', size: 1, price: '120.0000', is_default: false, quantity_available: 8 };
  const offer = {
    sale_form: MarketplaceSaleForms.PACKAGED,
    packages: [half, litre],
    price_per_unit: '120.0000',
    unit_of_measure: MarketplaceUnitsOfMeasure.LITER,
    quantity_available: 9.5,
    unlimited_flag: false,
  };

  it('сумма по упаковкам в базовых единицах: 3 × 0,5 + 8 × 1 = 9,5 л', () => {
    expect(packagedBaseQuantity([half, litre], 'quantity_available', MarketplaceUnitsOfMeasure.LITER)).toBe(9.5);
    expect(packagedBaseQuantity([half, litre], 'quantity_blocked', MarketplaceUnitsOfMeasure.LITER)).toBe(1.5);
  });

  it('нехватка по упаковке, хотя литров хватает; по мере — по базовым единицам', () => {
    expect(saleUnitShortfall(offer, resolveSaleUnit(offer, 5, 'pkg-0.5'))).toEqual({
      available: 3,
      requested: 5,
      unitLabel: 'упак.',
    });
    expect(saleUnitShortfall(offer, resolveSaleUnit(offer, 3, 'pkg-0.5'))).toBeNull();
    expect(saleUnitShortfall({ ...offer, unlimited_flag: true }, resolveSaleUnit(offer, 50, 'pkg-0.5'))).toBeNull();

    const byMeasure = { ...offer, sale_form: MarketplaceSaleForms.BY_MEASURE, packages: [], quantity_available: 2 };
    expect(saleUnitShortfall(byMeasure, resolveSaleUnit(byMeasure, 2.5, null))).toEqual({
      available: 2,
      requested: 2.5,
      unitLabel: 'ед.',
    });
  });

  it('упаковка заказа для счётчиков: из заказа и из разрешённой единицы отпуска', () => {
    expect(packageDeltaOfOrder({ package_id: 'pkg-0.5', package_size: 0.5, quantity: 2.5 })).toEqual({
      id: 'pkg-0.5',
      count: 5,
    });
    // Заказ до учёта по упаковкам и заказ по мере до упаковки не доходят.
    expect(packageDeltaOfOrder({ package_id: null, package_size: 0.5, quantity: 2.5 })).toBeUndefined();
    expect(packageDeltaOfOrder({ package_id: 'pkg-0.5', package_size: 0, quantity: 2.5 })).toBeUndefined();
  });

  it('остаток кооператива: снятие позиций уменьшает упаковку по содержимому, не ниже нуля', () => {
    const released = releasePackagesForPositions([half, litre], [
      { package_size: 0.5, quantity_per_label: 1 }, // две бутылки по 0,5
      { package_size: 1, quantity_per_label: 10 }, // десять литровых — больше, чем есть
      { package_size: 0, quantity_per_label: 7 }, // по мере — упаковок не касается
    ]);
    expect(released.map((p) => p.quantity_available)).toEqual([1, 0]);
    expect(adjustPackagesBySize([half], 0.7, -1).map((p) => p.quantity_available)).toEqual([3]);
  });
});
