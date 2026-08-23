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

  it('lineUnits = тело + членский взнос (формула контракта)', () => {
    // 3 × 10.0000, ставка 0% → только тело
    expect(service.lineUnits('10.0000', 3, 0)).toBe(300_000n);
    // 3 × 10.0000 = 300000, взнос 5% = 15000 → 315000
    expect(service.lineUnits('10.0000', 3, 50_000)).toBe(315_000n);
  });

  it('инвариант замены: членских хватает → дефицит 0', () => {
    // Высвобождено отменой ≥ сумма строки → конвертировать нечего.
    const lineUnits = service.lineUnits('25.0000', 2, 50_000); // 500000 + 25000 = 525000
    const memberAvailable = service.assetToUnits('60.0000 RUB'); // 600000
    const fromMember = memberAvailable >= lineUnits ? lineUnits : memberAvailable;
    const convertUnits = lineUnits - fromMember;
    expect(convertUnits).toBe(0n);
  });

  it('инвариант доплаты: членских не хватает → конвертируется только дефицит', () => {
    const lineUnits = service.lineUnits('25.0000', 2, 50_000); // 525000
    const memberAvailable = service.assetToUnits('20.0000 RUB'); // 200000
    const fromMember = memberAvailable >= lineUnits ? lineUnits : memberAvailable;
    const convertUnits = lineUnits - fromMember;
    expect(convertUnits).toBe(325_000n);
    expect(service.unitsToAsset(convertUnits)).toBe('32.5000 RUB');
  });
});
