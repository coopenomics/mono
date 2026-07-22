/**
 * Unit-тесты пересчёта строки акта АПП в физический объём (базовые единицы).
 *
 * Заказ считается в единицах заказа (фасовках), а юридический акт приёма-передачи
 * показывает переданное имущество в БАЗОВЫХ единицах: количество =
 * quantity × order_unit_size, цена — за базовую единицу, сумма акта неизменна
 * (количество × цена = сумме заказа).
 */
import { toPhysicalActLine } from '~/extensions/marketplace/application/shared/unit-label.util';

const DECIMALS = 4;

describe('toPhysicalActLine', () => {
  it('order_unit_size = 1 → количество и цена не меняются', () => {
    // 3 шт по 150, всего 450
    const { physicalQuantity, unitCostPerBase } = toPhysicalActLine(3, '450.0000', '1', DECIMALS);
    expect(physicalQuantity).toBe(3);
    expect(unitCostPerBase).toBe('150.0000');
  });

  it('фасовка 100 г (kg + 0.1): 3 фасовки → 0.3 кг, цена за кг', () => {
    // 3 фасовки по 100 г, цена 250 за фасовку, всего 750
    const { physicalQuantity, unitCostPerBase } = toPhysicalActLine(3, '750.0000', '0.1', DECIMALS);
    expect(physicalQuantity).toBeCloseTo(0.3, 6);
    expect(unitCostPerBase).toBe('2500.0000'); // 750 / 0.3
  });

  it('упаковка 8 шт (piece + 8): 2 упаковки → 16 шт, цена за штуку', () => {
    // 2 упаковки по 8 шт, цена 400 за упаковку, всего 800
    const { physicalQuantity, unitCostPerBase } = toPhysicalActLine(2, '800.0000', '8', DECIMALS);
    expect(physicalQuantity).toBe(16);
    expect(unitCostPerBase).toBe('50.0000'); // 800 / 16
  });

  it('количество × цена за базовую единицу = сумме акта', () => {
    const total = 750;
    const { physicalQuantity, unitCostPerBase } = toPhysicalActLine(3, total.toFixed(4), '0.1', DECIMALS);
    expect(physicalQuantity * Number.parseFloat(unitCostPerBase)).toBeCloseTo(total, 4);
  });

  it('пустой/невалидный order_unit_size трактуется как 1', () => {
    expect(toPhysicalActLine(5, '500.0000', null, DECIMALS).physicalQuantity).toBe(5);
    expect(toPhysicalActLine(5, '500.0000', undefined, DECIMALS).physicalQuantity).toBe(5);
    expect(toPhysicalActLine(5, '500.0000', '0', DECIMALS).physicalQuantity).toBe(5);
    expect(toPhysicalActLine(5, '500.0000', 'abc', DECIMALS).physicalQuantity).toBe(5);
  });

  it('нулевое количество → цена = сумме (без деления на ноль)', () => {
    const { physicalQuantity, unitCostPerBase } = toPhysicalActLine(0, '0.0000', '0.1', DECIMALS);
    expect(physicalQuantity).toBe(0);
    expect(unitCostPerBase).toBe('0.0000');
  });
});
