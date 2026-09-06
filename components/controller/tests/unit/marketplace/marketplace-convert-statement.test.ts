/**
 * Заявление 1110 о переводе паевого взноса в ЦПП «Стол заказов» с уплатой
 * членского взноса (паевая модель, компонент 68, решение владельца
 * 06.09.2026): текст — на полную сумму заказа с выделением взноса участка;
 * по кошелькам тело идёт паевыми кошельками, взнос — членскими: из паевого в
 * членский переводится ровно недостающая до взноса часть членского кошелька
 * программы, остаток кошелька зачитывается; подписанное заявление сверяется с
 * планом по свежему балансу.
 *
 * Реестр: mkt.order.side.30–32, mkt.order.side.33 (контракт), mkt.iss.side.44.
 */
import { BadRequestException } from '@nestjs/common';
import { MarketplaceConvertService } from '../../../src/extensions/marketplace/application/services/marketplace-convert.service';
import { buildMocks, buildOrder, buildSaga, buildService, stubSignatureChecks, signedDoc, toAsset, toUnits } from './issuance-saga.fixture';
import { MarketplaceIssuanceSagaStages } from '../../../src/extensions/marketplace/domain/entities/marketplace-issuance-saga.types';

function buildConvertService(memberAvailable: string, walletName = 'w.mkt.member'): MarketplaceConvertService {
  const walletRepo = {
    findByUsername: jest.fn(async () => [{ wallet_name: walletName, available: memberAvailable, blocked: '0.0000 RUB' }]),
  };
  const documentPort = {
    generate: jest.fn(async ({ data }: any) => ({ full_title: 'doc', html: '', hash: `hash-${data.registry_id}`, meta: data, binary: '' })),
  };
  const economy = {
    assetToUnits: (v: string) => toUnits(v),
    unitsToAsset: (u: bigint) => toAsset(u),
    toHumanFeePercent: (v: number) => (Number(v) * 100) / 1_000_000,
  };
  return new MarketplaceConvertService(walletRepo as never, documentPort as never, economy as never, { symbol: 'RUB', decimals: 4 } as never);
}

describe('mkt.order.side.30 — план конвертации: остаток членского кошелька зачитывается, конвертируется недостающее', () => {
  const svc = buildConvertService('0.0000 RUB');

  it('пустой членский кошелёк — конвертируется весь взнос по каждой строке', () => {
    const plan = svc.planConversions(0n, [30_0000n, 45_0000n]);
    expect(plan.map((p) => p.convert_units)).toEqual([30_0000n, 45_0000n]);
  });

  it('остатка хватает на первую строку целиком и часть второй — заявление только на недостающее', () => {
    const plan = svc.planConversions(40_0000n, [30_0000n, 45_0000n]);
    expect(plan[0]).toEqual({ fee_units: 30_0000n, convert_units: 0n });
    expect(plan[1]).toEqual({ fee_units: 45_0000n, convert_units: 35_0000n });
  });

  it('остатка хватает на всё — конвертации нет, подпись не требуется', () => {
    const plan = svc.planConversions(100_0000n, [30_0000n, 45_0000n]);
    expect(plan.every((p) => p.convert_units === 0n)).toBe(true);
  });

  it('нулевой взнос (ставка 0) — конвертации нет при любом балансе', () => {
    expect(svc.shortfallUnits(0n, 0n)).toBe(0n);
  });
});

describe('mkt.order.side.31 — заявление 1110: полная сумма с выделением взноса, в членский переводится только недостающее', () => {
  it('в мете — полная сумма, взнос участка, переводимая в членский часть, зачёт остатка и ставка кооператива', async () => {
    const svc = buildConvertService('10.0000 RUB');
    const available = await svc.memberAvailableUnits('coop', 'orderer1');
    expect(available).toBe(10_0000n);
    const doc = await svc.generateStatement({
      coopname: 'coop',
      username: 'orderer1',
      order_hash: 'h-order-1',
      body_units: 100_0000n,
      fee_units: 30_0000n,
      convert_units: svc.shortfallUnits(available, 30_0000n),
      fee_contract_percent: 300000,
      source: 'wallet',
    });
    expect(doc.meta).toMatchObject({
      registry_id: 1110,
      order_hash: 'h-order-1',
      amount: '130.0000 RUB',
      membership_fee: '30.0000 RUB',
      convert_amount: '20.0000 RUB',
      credited_amount: '10.0000 RUB',
      fee_percent: 30,
      source: 'wallet',
      skip_save: false,
    });
  });

  it('членский кошелёк пуст — переводится весь взнос, строки о зачёте нет', async () => {
    const svc = buildConvertService('0.0000 RUB');
    const doc = await svc.generateStatement({
      coopname: 'coop',
      username: 'orderer1',
      order_hash: 'h-order-1',
      body_units: 100_0000n,
      fee_units: 30_0000n,
      convert_units: 30_0000n,
      fee_contract_percent: 300000,
      source: 'market',
    });
    expect(doc.meta).toMatchObject({ amount: '130.0000 RUB', convert_amount: '30.0000 RUB', source: 'market' });
    expect((doc.meta as Record<string, unknown>).credited_amount).toBeUndefined();
  });

  it('членский кошелёк ещё не заведён (строки нет) — остаток 0', async () => {
    const svc = buildConvertService('5.0000 RUB', 'w.wal.share');
    expect(await svc.memberAvailableUnits('coop', 'orderer1')).toBe(0n);
  });
});

describe('mkt.order.side.32 — подписанное заявление сверяется с планом по свежему балансу', () => {
  const svc = buildConvertService('0.0000 RUB');
  const expected = { order_hash: 'h-order-1', body_units: 100_0000n, fee_units: 30_0000n, convert_units: 20_0000n };
  const signed = (meta: Record<string, unknown>) => ({
    ...signedDoc(
      { registry_id: 1110, order_hash: 'h-order-1', amount: '130.0000 RUB', membership_fee: '30.0000 RUB', convert_amount: '20.0000 RUB', fee_percent: 30, source: 'wallet', ...meta },
      ['orderer1']
    ),
  });

  it('заявления нет — «обновите оформление» с полной суммой', () => {
    expect(() => svc.verifySigned(null, expected, 'orderer1')).toThrow(/130\.0000 RUB/);
    expect(() => svc.verifySigned(null, expected, 'orderer1')).toThrow(BadRequestException);
  });

  it('заявление на другой заказ — отказ', () => {
    expect(() => svc.verifySigned(signed({ order_hash: 'h-other' }) as never, expected, 'orderer1')).toThrow(/другого заказа/);
  });

  it('цена позиции изменилась с превью (полная сумма разошлась) — отказ с обеими суммами', () => {
    expect(() => svc.verifySigned(signed({}) as never, { ...expected, body_units: 90_0000n }, 'orderer1')).toThrow(/130\.0000 RUB.*120\.0000 RUB/);
  });

  it('ставка взноса изменилась с превью — отказ', () => {
    expect(() => svc.verifySigned(signed({}) as never, { ...expected, body_units: 105_0000n, fee_units: 25_0000n }, 'orderer1')).toThrow(/Членский взнос изменился/);
  });

  it('баланс членского кошелька изменился с превью (переводимая часть разошлась) — отказ с обеими суммами', () => {
    expect(() => svc.verifySigned(signed({}) as never, { ...expected, convert_units: 15_0000n }, 'orderer1')).toThrow(/20\.0000 RUB.*15\.0000 RUB/);
  });

  it('всё сошлось — возвращается document2 для контракта', () => {
    const doc = signed({});
    jest.spyOn(svc as never as { verifySignature: () => void }, 'verifySignature').mockImplementation(() => undefined);
    expect(svc.verifySigned(doc as never, expected, 'orderer1')).toMatchObject({ hash: 'H' });
  });

  it('чужая подпись на заявлении — отказ', () => {
    const doc = signedDoc({ registry_id: 1110, order_hash: 'h-order-1', amount: '130.0000 RUB', membership_fee: '30.0000 RUB', convert_amount: '20.0000 RUB', fee_percent: 30, source: 'wallet' }, ['someone']);
    expect(() => svc.verifySigned(doc as never, expected, 'orderer1')).toThrow(/подписано учётной записью orderer1/);
  });
});

describe('mkt.iss.side.44 — довзнос по факту: заявление 1110 у стойки только когда факт больше заказа и членского кошелька не хватает', () => {
  const orderWithFee = () => buildOrder({ total_cost: '100.0000 RUB', membership_fee: '30.0000 RUB' } as never);

  it('факт меньше или равен заказу — довзноса нет, заявления нет', async () => {
    const m = buildMocks({ order: orderWithFee(), sagas: [buildSaga({ fact: { actual_quantity: 5, actual_unit_price: '10.0000', fact_cost: '50.0000 RUB' } } as never)] });
    const service = buildService(m);
    expect(await service.getConvertSignablePayload('coop', 'order-1', 'orderer1')).toBeNull();
    expect(m.convertService.generateStatement).not.toHaveBeenCalled();
  });

  it('факт больше заказа и членского кошелька хватает — заявления нет', async () => {
    const m = buildMocks({ order: orderWithFee(), sagas: [buildSaga({ fact: { actual_quantity: 12, actual_unit_price: '10.0000', fact_cost: '120.0000 RUB' } } as never)] });
    const service = buildService(m);
    expect(await service.getConvertSignablePayload('coop', 'order-1', 'orderer1')).toBeNull();
  });

  it('факт больше заказа, кошелёк пуст — заявление на разницу взноса по пропорции контракта', async () => {
    const m = buildMocks({
      order: orderWithFee(),
      sagas: [buildSaga({ fact: { actual_quantity: 12, actual_unit_price: '10.0000', fact_cost: '120.0000 RUB' } } as never)],
      memberAvailableUnits: 0n,
    });
    const service = buildService(m);
    const doc = await service.getConvertSignablePayload('coop', 'order-1', 'orderer1');
    // fact_fee = 30 × 120 / 100 = 36; довзнос = 6; доплата тела = 20 — заявление на 26, из них взнос 6.
    expect(doc?.meta).toMatchObject({ order_hash: 'h-order-1', amount: '26.0000 RUB', membership_fee: '6.0000 RUB', convert_amount: '6.0000 RUB', source: 'market' });
    expect(m.convertService.generateStatement).toHaveBeenCalledWith(expect.objectContaining({ body_units: 20_0000n, fee_units: 6_0000n, convert_units: 6_0000n }));
  });

  it('подача заявления о выдаче без заявления 1110 при нужном довзносе — отказ, цепь не трогаем', async () => {
    const m = buildMocks({
      order: orderWithFee(),
      sagas: [buildSaga({ fact: { actual_quantity: 12, actual_unit_price: '10.0000', fact_cost: '120.0000 RUB' } } as never)],
      memberAvailableUnits: 0n,
    });
    const service = buildService(m);
    stubSignatureChecks(service);
    await expect(
      service.submitStatement({
        coopname: 'coop',
        member_account: 'orderer1',
        order_id: 'order-1',
        signed_statement: signedDoc({ registry_id: 1113, order_hash: 'h-order-1', total_amount: '120.0000 RUB' }, ['orderer1']) as never,
        signed_convert: null,
      })
    ).rejects.toThrow(/заявления о переводе/);
    expect(m.chainPort.issueStmt).not.toHaveBeenCalled();
  });

  it('заявление 1110 приложено — уходит в issuestmt параметром convert_statement', async () => {
    const m = buildMocks({
      order: orderWithFee(),
      sagas: [buildSaga({ fact: { actual_quantity: 12, actual_unit_price: '10.0000', fact_cost: '120.0000 RUB' } } as never)],
      memberAvailableUnits: 0n,
    });
    const service = buildService(m);
    stubSignatureChecks(service);
    await service.submitStatement({
      coopname: 'coop',
      member_account: 'orderer1',
      order_id: 'order-1',
      signed_statement: signedDoc({ registry_id: 1113, order_hash: 'h-order-1', total_amount: '120.0000 RUB' }, ['orderer1']) as never,
      signed_convert: signedDoc({ registry_id: 1110, order_hash: 'h-order-1', amount: '26.0000 RUB', membership_fee: '6.0000 RUB', convert_amount: '6.0000 RUB' }, ['orderer1']) as never,
    });
    expect(m.convertService.verifySigned).toHaveBeenCalledWith(
      expect.anything(),
      { order_hash: 'h-order-1', body_units: 20_0000n, fee_units: 6_0000n, convert_units: 6_0000n },
      'orderer1'
    );
    expect(m.chainPort.issueStmt).toHaveBeenCalledWith(expect.objectContaining({ convert_statement: expect.objectContaining({ hash: expect.any(String) }) }));
  });

  it('обычная выдача без довзноса — в issuestmt уходит пустой документ', async () => {
    const m = buildMocks({ order: orderWithFee(), sagas: [buildSaga({ fact: { actual_quantity: 5, actual_unit_price: '10.0000', fact_cost: '50.0000 RUB' } } as never)] });
    const service = buildService(m);
    stubSignatureChecks(service);
    await service.submitStatement({
      coopname: 'coop',
      member_account: 'orderer1',
      order_id: 'order-1',
      signed_statement: signedDoc({ registry_id: 1113, order_hash: 'h-order-1', total_amount: '50.0000 RUB' }, ['orderer1']) as never,
    });
    expect(m.chainPort.issueStmt).toHaveBeenCalledWith(expect.objectContaining({ convert_statement: expect.objectContaining({ meta: '' }) }));
    expect(m.convertService.verifySigned).not.toHaveBeenCalled();
  });
});
