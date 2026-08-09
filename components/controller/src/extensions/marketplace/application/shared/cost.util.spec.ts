import { BadRequestException } from '@nestjs/common';
import {
  calcCostAmount,
  compareMoney,
  decimalStringToMinor,
  minorToDecimalString,
  proRataByMoney,
  proRataByQuantity,
  sumMoney,
} from './cost.util';
import { MarketplaceUnitsOfMeasure } from '../../domain/entities/marketplace-offer.types';

const DECIMALS = 4;

describe('cost.util — денежная арифметика зеркалит контракт', () => {
  describe('calcCostAmount — отпуск по мере', () => {
    it('считает вес × цену за базовую единицу', () => {
      expect(
        calcCostAmount({
          quantity: 1.5,
          unit: MarketplaceUnitsOfMeasure.KG,
          unitPrice: '100.0000',
          decimals: DECIMALS,
        })
      ).toBe('150.0000');
    });

    it('округляет половину вверх — как контракт, а не как toFixed', () => {
      // 1.5 кг × 0.0001 = 0.00015: контракт округляет половину вверх (0.0002),
      // а double-умножение с toFixed давало 0.0001 — расхождение с цепью.
      expect(
        calcCostAmount({
          quantity: 1.5,
          unit: MarketplaceUnitsOfMeasure.KG,
          unitPrice: '0.0001',
          decimals: DECIMALS,
        })
      ).toBe('0.0002');
    });

    it('считает штуки (единица неделима)', () => {
      expect(
        calcCostAmount({
          quantity: 3,
          unit: MarketplaceUnitsOfMeasure.PIECE,
          unitPrice: '33.3333',
          decimals: DECIMALS,
        })
      ).toBe('99.9999');
    });

    it('не теряет точность на суммах за пределами разрядности double', () => {
      expect(
        calcCostAmount({
          quantity: 999999,
          unit: MarketplaceUnitsOfMeasure.PIECE,
          unitPrice: '999999.9999',
          decimals: DECIMALS,
        })
      ).toBe('999998999900.0001');
    });
  });

  describe('calcCostAmount — отпуск упаковкой', () => {
    it('считает от числа упаковок, а не от базового количества', () => {
      // Инцидент 2026-07-25: 10 упаковок по 0.1 л при цене 100 ₽ за упаковку —
      // это 1000 ₽, а не 100 ₽ (базовое количество × цена).
      expect(
        calcCostAmount({
          quantity: 1,
          unit: MarketplaceUnitsOfMeasure.LITER,
          unitPrice: '100.0000',
          packageSize: 0.1,
          decimals: DECIMALS,
        })
      ).toBe('1000.0000');
    });

    it('делит без округления копейки', () => {
      expect(
        calcCostAmount({
          quantity: 0.777,
          unit: MarketplaceUnitsOfMeasure.KG,
          unitPrice: '99.9999',
          packageSize: 0.259,
          decimals: DECIMALS,
        })
      ).toBe('299.9997');
    });

    it('отвергает количество, не кратное упаковке', () => {
      expect(() =>
        calcCostAmount({
          quantity: 0.35,
          unit: MarketplaceUnitsOfMeasure.LITER,
          unitPrice: '100.0000',
          packageSize: 0.1,
          decimals: DECIMALS,
        })
      ).toThrow(BadRequestException);
    });
  });

  describe('proRataByQuantity — доля суммы по количеству', () => {
    it('при возврате всего выданного возвращает сумму целиком', () => {
      expect(
        proRataByQuantity({
          total: '333.3333',
          part: 0.777,
          whole: 0.777,
          unit: MarketplaceUnitsOfMeasure.KG,
          decimals: DECIMALS,
        })
      ).toBe('333.3333');
    });

    it('делит сумму пропорционально возвращаемой части', () => {
      expect(
        proRataByQuantity({
          total: '1000.0000',
          part: 0.25,
          whole: 1,
          unit: MarketplaceUnitsOfMeasure.KG,
          decimals: DECIMALS,
        })
      ).toBe('250.0000');
    });

    it('округляет половину вверх', () => {
      // 1.0000 / 2 = 0.50005 → 0.5001 (половина младшей единицы вверх).
      expect(
        proRataByQuantity({
          total: '1.0001',
          part: 1,
          whole: 2,
          unit: MarketplaceUnitsOfMeasure.PIECE,
          decimals: DECIMALS,
        })
      ).toBe('0.5001');
    });
  });

  describe('proRataByMoney — доля суммы по суммам', () => {
    it('считает долю взноса, принятую на выдаче', () => {
      // Взнос 300 ₽ при заказе на 1000 ₽; выдано на 700 ₽ → принято 210 ₽.
      expect(
        proRataByMoney({
          total: '300.0000',
          part: '700.0000',
          whole: '1000.0000',
          decimals: DECIMALS,
        })
      ).toBe('210.0000');
    });
  });

  describe('вспомогательные преобразования', () => {
    it('суммирует без накопления погрешности double', () => {
      expect(sumMoney(['0.1000', '0.2000'], DECIMALS)).toBe('0.3000');
    });

    it('сравнивает суммы точно', () => {
      expect(compareMoney('0.3000', '0.3000', DECIMALS)).toBe(0);
      expect(compareMoney('0.2999', '0.3000', DECIMALS)).toBe(-1);
      expect(compareMoney('0.3001', '0.3000', DECIMALS)).toBe(1);
    });

    it('отвергает величину точнее заявленной разрядности вместо тихого округления', () => {
      expect(() => decimalStringToMinor('0.00005', DECIMALS)).toThrow(BadRequestException);
    });

    it('переводит младшие единицы в десятичную строку', () => {
      expect(minorToDecimalString(1500000n, DECIMALS)).toBe('150.0000');
      expect(minorToDecimalString(1n, DECIMALS)).toBe('0.0001');
      expect(minorToDecimalString(0n, DECIMALS)).toBe('0.0000');
    });
  });
});
