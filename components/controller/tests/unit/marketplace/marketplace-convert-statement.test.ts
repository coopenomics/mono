/**
 * Заявление 1110 о переводе паевого взноса в ЦПП «Стол заказов» (паевая
 * модель, уточнение владельца 06.09.2026): внутренний членский кошелёк
 * программы расходуется первым — на взнос участка и на тело заказа; заявление
 * пишется только на недостающую сумму («прошу перевести с баланса моего
 * Цифрового кошелька на баланс ЦПП «Стол заказов» N, из них членский взнос
 * M») и не пишется вовсе, если кошелька хватает; перевод членской части —
 * отдельная транзакция convert до заказа; подписанное заявление сверяется с
 * планом по свежему балансу.
 *
 * Реестр: mkt.order.side.30–32, mkt.order.side.33 (контракт), mkt.iss.side.44.
 */
import { BadRequestException } from '@nestjs/common';
import { MarketplaceConvertService } from '../../../src/extensions/marketplace/application/services/marketplace-convert.service';
import { buildMocks, buildOrder, buildSaga, buildService, stubSignatureChecks, signedDoc, toAsset, toUnits } from './issuance-saga.fixture';

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
  };
  return new MarketplaceConvertService(walletRepo as never, documentPort as never, economy as never, { symbol: 'RUB', decimals: 4 } as never);
}

describe('mkt.order.side.30 — план фондирования: членский кошелёк первым (взнос, затем тело), недостающее — с паевого', () => {
  const svc = buildConvertService('0.0000 RUB');

  it('пустой членский кошелёк — весь взнос переводится в членский, всё тело с паевого', () => {
    const plan = svc.planFunding(0n, [{ body_units: 100_0000n, fee_units: 30_0000n }]);
    expect(plan.lines[0]).toMatchObject({ fee_convert_units: 30_0000n, body_member_units: 0n, body_share_units: 100_0000n });
    expect(plan.transfer_units).toBe(130_0000n);
    expect(plan.fee_convert_units).toBe(30_0000n);
  });

  it('кошелька хватает на взнос и часть тела — переводить в членский нечего, с паевого только остаток тела', () => {
    const plan = svc.planFunding(70_0000n, [{ body_units: 100_0000n, fee_units: 30_0000n }]);
    expect(plan.lines[0]).toMatchObject({ fee_convert_units: 0n, body_member_units: 40_0000n, body_share_units: 60_0000n });
    expect(plan.transfer_units).toBe(60_0000n);
  });

  it('кошелька хватает на весь заказ — заявления нет вовсе', () => {
    const plan = svc.planFunding(500_0000n, [{ body_units: 100_0000n, fee_units: 30_0000n }, { body_units: 50_0000n, fee_units: 15_0000n }]);
    expect(plan.transfer_units).toBe(0n);
    expect(plan.lines.every((l) => l.body_share_units === 0n && l.fee_convert_units === 0n)).toBe(true);
  });

  it('несколько строк: остаток кошелька тянется последовательно, вторая строка добирает взнос переводом', () => {
    const plan = svc.planFunding(40_0000n, [{ body_units: 100_0000n, fee_units: 30_0000n }, { body_units: 50_0000n, fee_units: 15_0000n }]);
    expect(plan.lines[0]).toMatchObject({ fee_convert_units: 0n, body_member_units: 10_0000n, body_share_units: 90_0000n });
    expect(plan.lines[1]).toMatchObject({ fee_convert_units: 15_0000n, body_member_units: 0n, body_share_units: 50_0000n });
    expect(plan.fee_convert_units).toBe(15_0000n);
    expect(plan.transfer_units).toBe(155_0000n);
  });

  it('нулевой взнос (ставка 0) — в членский переводить нечего при любом балансе', () => {
    expect(svc.shortfallUnits(0n, 0n)).toBe(0n);
  });
});

describe('mkt.order.side.31 — заявление 1110: только недостающая сумма и членская часть в ней', () => {
  it('в мете — якорь, недостающая сумма, членская часть и источник; ничего лишнего', async () => {
    const svc = buildConvertService('10.0000 RUB');
    const available = await svc.memberAvailableUnits('coop', 'orderer1');
    expect(available).toBe(10_0000n);
    const plan = svc.planFunding(available, [{ body_units: 100_0000n, fee_units: 30_0000n }]);
    const doc = await svc.generateStatement({
      coopname: 'coop',
      username: 'orderer1',
      anchor_hash: 'anchor-1',
      amount_units: plan.transfer_units,
      fee_units: plan.fee_convert_units,
      source: 'wallet',
    });
    expect(doc.meta).toMatchObject({ registry_id: 1110, order_hash: 'anchor-1', amount: '120.0000 RUB', membership_fee: '20.0000 RUB', source: 'wallet', skip_save: false });
    expect(Object.keys(doc.meta as object).sort()).toEqual(['amount', 'coopname', 'lang', 'membership_fee', 'order_hash', 'registry_id', 'skip_save', 'source', 'username']);
  });

  it('членский кошелёк ещё не заведён (строки нет) — остаток 0', async () => {
    const svc = buildConvertService('5.0000 RUB', 'w.wal.share');
    expect(await svc.memberAvailableUnits('coop', 'orderer1')).toBe(0n);
  });
});

describe('mkt.order.side.32 — подписанное заявление сверяется с планом по свежему балансу', () => {
  const svc = buildConvertService('0.0000 RUB');
  const expected = { anchor_hash: 'anchor-1', amount_units: 120_0000n, fee_units: 20_0000n };
  const signed = (meta: Record<string, unknown>) => ({
    ...signedDoc({ registry_id: 1110, order_hash: 'anchor-1', amount: '120.0000 RUB', membership_fee: '20.0000 RUB', source: 'wallet', ...meta }, ['orderer1']),
  });

  it('заявления нет — «обновите оформление» с недостающей суммой', () => {
    expect(() => svc.verifySigned(null, expected, 'orderer1')).toThrow(/120\.0000 RUB/);
    expect(() => svc.verifySigned(null, expected, 'orderer1')).toThrow(BadRequestException);
  });

  it('заявление на другое оформление — отказ', () => {
    expect(() => svc.verifySigned(signed({ order_hash: 'anchor-other' }) as never, expected, 'orderer1')).toThrow(/другого оформления/);
  });

  it('баланс кошелька изменился с превью — недостающая сумма разошлась, отказ с обеими суммами', () => {
    expect(() => svc.verifySigned(signed({}) as never, { ...expected, amount_units: 110_0000n, fee_units: 10_0000n }, 'orderer1')).toThrow(/120\.0000 RUB.*110\.0000 RUB/);
  });

  it('членская часть разошлась при той же сумме — отказ', () => {
    expect(() => svc.verifySigned(signed({}) as never, { ...expected, fee_units: 25_0000n }, 'orderer1')).toThrow(/Членская часть/);
  });

  it('всё сошлось — возвращается document2 для контракта', () => {
    jest.spyOn(svc as never as { verifySignature: () => void }, 'verifySignature').mockImplementation(() => undefined);
    expect(svc.verifySigned(signed({}) as never, expected, 'orderer1')).toMatchObject({ hash: 'H' });
  });

  it('чужая подпись на заявлении — отказ', () => {
    const doc = signedDoc({ registry_id: 1110, order_hash: 'anchor-1', amount: '120.0000 RUB', membership_fee: '20.0000 RUB', source: 'wallet' }, ['someone']);
    expect(() => svc.verifySigned(doc as never, expected, 'orderer1')).toThrow(/подписано учётной записью orderer1/);
  });
});

describe('mkt.iss.side.44 — доплата по факту: заявление 1110 и перевод convert только когда членского кошелька не хватает на довзнос', () => {
  const orderWithFee = () => buildOrder({ total_cost: '100.0000 RUB', membership_fee: '30.0000 RUB' } as never);
  const bigFact = () => buildSaga({ fact: { actual_quantity: 12, actual_unit_price: '10.0000', fact_cost: '120.0000 RUB' } } as never);
  const stmt = (total: string) => signedDoc({ registry_id: 1113, order_hash: 'h-order-1', total_amount: total }, ['orderer1']) as never;

  it('факт меньше или равен заказу — довзноса нет, заявления нет', async () => {
    const m = buildMocks({ order: orderWithFee(), sagas: [buildSaga({ fact: { actual_quantity: 5, actual_unit_price: '10.0000', fact_cost: '50.0000 RUB' } } as never)] });
    const service = buildService(m);
    expect(await service.getConvertSignablePayload('coop', 'order-1', 'orderer1')).toBeNull();
    expect(m.convertService.generateStatement).not.toHaveBeenCalled();
  });

  it('факт больше заказа и членского кошелька хватает на довзнос — заявления нет', async () => {
    const m = buildMocks({ order: orderWithFee(), sagas: [bigFact()] });
    const service = buildService(m);
    expect(await service.getConvertSignablePayload('coop', 'order-1', 'orderer1')).toBeNull();
  });

  it('факт больше заказа, кошелёк пуст — заявление на доплату тела и довзнос по пропорции контракта', async () => {
    const m = buildMocks({ order: orderWithFee(), sagas: [bigFact()], memberAvailableUnits: 0n });
    const service = buildService(m);
    const doc = await service.getConvertSignablePayload('coop', 'order-1', 'orderer1');
    // fact_fee = 30 × 120 / 100 = 36; довзнос = 6; доплата тела = 20 — заявление на 26, из них членский взнос 6.
    expect(doc?.meta).toMatchObject({ order_hash: 'h-order-1', amount: '26.0000 RUB', membership_fee: '6.0000 RUB', source: 'market' });
  });

  it('подача заявления о выдаче без заявления 1110 при нужном довзносе — отказ, цепь не трогаем', async () => {
    const m = buildMocks({ order: orderWithFee(), sagas: [bigFact()], memberAvailableUnits: 0n });
    const service = buildService(m);
    stubSignatureChecks(service);
    await expect(
      service.submitStatement({ coopname: 'coop', member_account: 'orderer1', order_id: 'order-1', signed_statement: stmt('120.0000 RUB'), signed_convert: null })
    ).rejects.toThrow(/заявления о переводе/);
    expect(m.chainPort.convert).not.toHaveBeenCalled();
    expect(m.chainPort.issueStmt).not.toHaveBeenCalled();
  });

  it('заявление 1110 приложено — сначала convert со свободного паевого на членскую часть, затем issuestmt без документа', async () => {
    const m = buildMocks({ order: orderWithFee(), sagas: [bigFact()], memberAvailableUnits: 0n });
    const service = buildService(m);
    stubSignatureChecks(service);
    await service.submitStatement({
      coopname: 'coop',
      member_account: 'orderer1',
      order_id: 'order-1',
      signed_statement: stmt('120.0000 RUB'),
      signed_convert: signedDoc({ registry_id: 1110, order_hash: 'h-order-1', amount: '26.0000 RUB', membership_fee: '6.0000 RUB', source: 'market' }, ['orderer1']) as never,
    });
    expect(m.convertService.verifySigned).toHaveBeenCalledWith(expect.anything(), { anchor_hash: 'h-order-1', amount_units: 26_0000n, fee_units: 6_0000n }, 'orderer1');
    expect(m.chainPort.convert).toHaveBeenCalledWith(expect.objectContaining({ orderer: 'orderer1', amount: '6.0000 RUB', from_market: true }));
    const convertOrder = m.chainPort.convert.mock.invocationCallOrder[0];
    const stmtOrder = m.chainPort.issueStmt.mock.invocationCallOrder[0];
    expect(convertOrder).toBeLessThan(stmtOrder);
    expect(m.chainPort.issueStmt).toHaveBeenCalledWith(expect.not.objectContaining({ convert_statement: expect.anything() }));
  });

  it('обычная выдача без довзноса — convert не зовётся', async () => {
    const m = buildMocks({ order: orderWithFee(), sagas: [buildSaga({ fact: { actual_quantity: 5, actual_unit_price: '10.0000', fact_cost: '50.0000 RUB' } } as never)] });
    const service = buildService(m);
    stubSignatureChecks(service);
    await service.submitStatement({ coopname: 'coop', member_account: 'orderer1', order_id: 'order-1', signed_statement: stmt('50.0000 RUB') });
    expect(m.chainPort.convert).not.toHaveBeenCalled();
    expect(m.convertService.verifySigned).not.toHaveBeenCalled();
  });
});
