/**
 * Unit-тесты подписи единицы заказа (фасовки) для актов АПП.
 *
 * Заказ и акт ведутся В ЕДИНИЦАХ ЗАКАЗА без пересчёта в базовые: `order_unit_size`
 * задаёт только человекочитаемый ярлык единицы («упаковка 8 шт» / «100 г» / «кг»),
 * а не множитель для разворота количества.
 */
import { marketplaceOrderUnitLabel } from '~/extensions/marketplace/application/shared/unit-label.util';

describe('marketplaceOrderUnitLabel', () => {
  it('kg: доля < 1 → граммы, ≥ 1 → килограммы', () => {
    expect(marketplaceOrderUnitLabel('kg', '0.1')).toBe('100 г');
    expect(marketplaceOrderUnitLabel('kg', '0.25')).toBe('250 г');
    expect(marketplaceOrderUnitLabel('kg', '1')).toBe('1 кг');
    expect(marketplaceOrderUnitLabel('kg', '2.5')).toBe('2.5 кг');
  });

  it('liter: доля < 1 → миллилитры, ≥ 1 → литры', () => {
    expect(marketplaceOrderUnitLabel('liter', '0.5')).toBe('500 мл');
    expect(marketplaceOrderUnitLabel('liter', '1')).toBe('1 л');
    expect(marketplaceOrderUnitLabel('liter', '1.5')).toBe('1.5 л');
  });

  it('piece: 1 → «шт», больше → «упаковка N шт»', () => {
    expect(marketplaceOrderUnitLabel('piece', '1')).toBe('шт');
    expect(marketplaceOrderUnitLabel('piece', '8')).toBe('упаковка 8 шт');
    expect(marketplaceOrderUnitLabel('piece', '12')).toBe('упаковка 12 шт');
  });

  it('пустой/невалидный размер трактуется как 1', () => {
    expect(marketplaceOrderUnitLabel('piece', null)).toBe('шт');
    expect(marketplaceOrderUnitLabel('piece', undefined)).toBe('шт');
    expect(marketplaceOrderUnitLabel('kg', '0')).toBe('1 кг');
    expect(marketplaceOrderUnitLabel('kg', 'abc')).toBe('1 кг');
  });
});
