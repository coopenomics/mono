import { MarketplaceUnitsOfMeasure } from '../../domain/entities/marketplace-offer.types';
import { MarketplaceEconomyService } from './marketplace-economy.service';

/**
 * Чистая units-математика суммы конвертации/заказа из остатка. Эти помощники —
 * основа deficit-аллокации замены непоставленного: ошибка округления/формата
 * здесь рассинхронизирует сумму `convert` с фактическим списанием on-chain.
 *
 * Контрактная шкала процентов HUNDR_PERCENTS = 1_000_000 (100%); 5% = 50_000.
 */
describe('MarketplaceEconomyService — units↔asset, lineUnits', () => {
  const service = new MarketplaceEconomyService(
    null as never,
    null as never,
    { decimals: 4, symbol: 'RUB' } as never,
    null as never,
    null as never,
    null as never,
    null as never,
    null as never,
    null as never
  );

  it('assetToUnits: с символом и без, дробная часть добивается', () => {
    expect(service.assetToUnits('123.4500 RUB')).toBe(1_234_500n);
    expect(service.assetToUnits('50.0000')).toBe(500_000n);
    expect(service.assetToUnits('0.0001 RUB')).toBe(1n);
    expect(service.assetToUnits('7')).toBe(70_000n);
  });

  it('unitsToAsset: формат X.XXXX RUB', () => {
    expect(service.unitsToAsset(1_234_500n)).toBe('123.4500 RUB');
    expect(service.unitsToAsset(1n)).toBe('0.0001 RUB');
    expect(service.unitsToAsset(0n)).toBe('0.0000 RUB');
  });

  it('round-trip assetToUnits→unitsToAsset', () => {
    for (const a of ['99.9999 RUB', '1000.0000 RUB', '0.0500 RUB']) {
      expect(service.unitsToAsset(service.assetToUnits(a))).toBe(a);
    }
  });

  // Тело строки — каноническим расчётом стоимости (calcCostMinor), взнос —
  // формулой контракта. До 25.09.2026 тело считалось BigInt(количество), и
  // дробная мера (1,5 кг) роняла превью и оформление корзины ошибкой 500.
  const lineUnits = (sale: { baseQuantity: number; unitPrice: string; packageSize: number }, unit: any, percent: number) => {
    const body = service.lineBodyUnits(sale, unit);
    return body + service.membershipFeeUnits(body, percent);
  };

  it('тело строки по мере — количество × цена, в том числе дробное количество', () => {
    expect(service.lineBodyUnits({ baseQuantity: 3, unitPrice: '10.0000', packageSize: 0 }, MarketplaceUnitsOfMeasure.PIECE)).toBe(300_000n);
    // 1,5 кг × 600 = 900 — прежде падало «cannot be converted to a BigInt».
    expect(service.lineBodyUnits({ baseQuantity: 1.5, unitPrice: '600.0000', packageSize: 0 }, MarketplaceUnitsOfMeasure.KG)).toBe(9_000_000n);
    // 0,333 кг × 10 = 3,33 — округление половины вверх, как в контракте.
    expect(service.lineBodyUnits({ baseQuantity: 0.333, unitPrice: '10.0000', packageSize: 0 }, MarketplaceUnitsOfMeasure.KG)).toBe(33_300n);
  });

  it('тело строки упаковкой — число упаковок × цена упаковки', () => {
    // 2 бутылки по 0,5 л по 80 = 160.
    expect(service.lineBodyUnits({ baseQuantity: 1, unitPrice: '80.0000', packageSize: 0.5 }, MarketplaceUnitsOfMeasure.LITER)).toBe(1_600_000n);
  });

  it('тело + членский взнос (формула контракта)', () => {
    // 3 × 10.0000 = 300000, взнос 5% = 15000 → 315000
    expect(lineUnits({ baseQuantity: 3, unitPrice: '10.0000', packageSize: 0 }, MarketplaceUnitsOfMeasure.PIECE, 0)).toBe(300_000n);
    expect(lineUnits({ baseQuantity: 3, unitPrice: '10.0000', packageSize: 0 }, MarketplaceUnitsOfMeasure.PIECE, 50_000)).toBe(315_000n);
  });

  it('инвариант замены: членских хватает → дефицит 0', () => {
    // Высвобождено отменой ≥ сумма строки → конвертировать нечего.
    const line = lineUnits({ baseQuantity: 2, unitPrice: '25.0000', packageSize: 0 }, MarketplaceUnitsOfMeasure.PIECE, 50_000); // 525000
    const memberAvailable = service.assetToUnits('60.0000 RUB'); // 600000
    const fromMember = memberAvailable >= line ? line : memberAvailable;
    expect(line - fromMember).toBe(0n);
  });

  it('инвариант доплаты: членских не хватает → конвертируется только дефицит', () => {
    const line = lineUnits({ baseQuantity: 2, unitPrice: '25.0000', packageSize: 0 }, MarketplaceUnitsOfMeasure.PIECE, 50_000); // 525000
    const memberAvailable = service.assetToUnits('20.0000 RUB'); // 200000
    const fromMember = memberAvailable >= line ? line : memberAvailable;
    const convertUnits = line - fromMember;
    expect(convertUnits).toBe(325_000n);
    expect(service.unitsToAsset(convertUnits)).toBe('32.5000 RUB');
  });
});
