/**
 * Unit-тесты подписи базовой единицы измерения для актов АПП (Эпик 17).
 *
 * Количество ведётся в базовых единицах (кг/л/шт), поэтому ярлык — это сама
 * единица; понятие «фасовки» (order_unit_size) упразднено.
 */
import { marketplaceOrderUnitLabel } from '~/extensions/marketplace/application/shared/unit-label.util';

describe('marketplaceOrderUnitLabel', () => {
  it('возвращает русскую подпись базовой единицы', () => {
    expect(marketplaceOrderUnitLabel('kg')).toBe('кг');
    expect(marketplaceOrderUnitLabel('liter')).toBe('л');
    expect(marketplaceOrderUnitLabel('piece')).toBe('шт');
  });

  it('неизвестная/пустая единица трактуется как штука', () => {
    expect(marketplaceOrderUnitLabel(null)).toBe('шт');
    expect(marketplaceOrderUnitLabel(undefined)).toBe('шт');
  });
});
