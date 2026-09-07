/**
 * Заявление 1110 о переводе паевого взноса в ЦПП «Стол заказов» (паевая
 * модель, уточнения владельца 06–07.09.2026): два кошелька программы
 * оплачивают каждый свою часть — членский кошелёк взносы, свободный паевой
 * тела; заявление — «прошу перевести с баланса моего Цифрового кошелька на
 * баланс ЦПП «Стол заказов» N, из них членский взнос M» — только на то, чего в
 * них не хватило; перевод M — отдельная транзакция convert до заказа;
 * подписанное заявление сверяется с планом по свежим балансам.
 *
 * Реестр: mkt.order.side.30–32, mkt.order.side.33–34 (контракт), mkt.iss.side.44.
 */
import { BadRequestException } from '@nestjs/common';
import { MarketplaceConvertService } from '../../../src/extensions/marketplace/application/services/marketplace-convert.service';
import { COOP, buildMocks, buildOrder, buildSaga, buildService, stubSignatureChecks, signedDoc, toAsset, toUnits } from './issuance-saga.fixture';

function buildConvertService(memberAvailable: string, walletName = 'w.mkt.member', shareAvailable = '0.0000 RUB'): MarketplaceConvertService {
  const walletRepo = {
    findByUsername: jest.fn(async () => [
      { wallet_name: walletName, available: memberAvailable, blocked: '0.0000 RUB' },
      { wallet_name: 'w.mkt.share', available: shareAvailable, blocked: '0.0000 RUB' },
    ]),
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

describe('mkt.order.side.30 — план: членский кошелёк на взнос, свободный паевой на тело, недостающее — с Цифрового кошелька', () => {
  const svc = buildConvertService('0.0000 RUB');

  it('кошельки программы пусты — всё с Цифрового кошелька: заявление на тело плюс взнос', () => {
    const plan = svc.planFunding({ member: 0n, share: 0n }, [{ body_units: 100_0000n, fee_units: 30_0000n }]);
    expect(plan.lines[0]).toMatchObject({ fee_member_units: 0n, fee_convert_units: 30_0000n, body_program_units: 0n, body_wallet_units: 100_0000n });
    expect(plan.transfer_units).toBe(130_0000n);
    expect(plan.fee_convert_units).toBe(30_0000n);
  });

  it('пример владельца: членский 10, паевой программы 30 — членская часть уменьшает взнос, паевая — тело', () => {
    const plan = svc.planFunding({ member: 10_0000n, share: 30_0000n }, [{ body_units: 100_0000n, fee_units: 30_0000n }]);
    expect(plan.lines[0]).toMatchObject({ fee_member_units: 10_0000n, fee_convert_units: 20_0000n, body_program_units: 30_0000n, body_wallet_units: 70_0000n });
    expect(plan.transfer_units).toBe(90_0000n);
    expect(plan.fee_convert_units).toBe(20_0000n);
  });

  it('кошельков хватает на всё — заявления нет, с Цифрового кошелька ничего не уходит', () => {
    const plan = svc.planFunding({ member: 500_0000n, share: 500_0000n }, [{ body_units: 100_0000n, fee_units: 30_0000n }]);
    expect(plan.transfer_units).toBe(0n);
  });

  it('кошельки не подменяют друг друга: паевой программы не оплачивает взнос, членский — тело', () => {
    const plan = svc.planFunding({ member: 0n, share: 500_0000n }, [{ body_units: 100_0000n, fee_units: 30_0000n }]);
    expect(plan.lines[0]).toMatchObject({ fee_convert_units: 30_0000n, body_wallet_units: 0n });
    const plan2 = svc.planFunding({ member: 500_0000n, share: 0n }, [{ body_units: 100_0000n, fee_units: 30_0000n }]);
    expect(plan2.lines[0]).toMatchObject({ fee_convert_units: 0n, body_wallet_units: 100_0000n });
  });

  it('несколько строк: остатки обоих кошельков тянутся последовательно', () => {
    const plan = svc.planFunding({ member: 40_0000n, share: 120_0000n }, [{ body_units: 100_0000n, fee_units: 30_0000n }, { body_units: 50_0000n, fee_units: 15_0000n }]);
    expect(plan.lines[0]).toMatchObject({ fee_member_units: 30_0000n, fee_convert_units: 0n, body_program_units: 100_0000n, body_wallet_units: 0n });
    expect(plan.lines[1]).toMatchObject({ fee_member_units: 10_0000n, fee_convert_units: 5_0000n, body_program_units: 20_0000n, body_wallet_units: 30_0000n });
    expect(plan.transfer_units).toBe(35_0000n);
  });

  it('нулевой взнос (ставка 0) — в членский переводить нечего при любом балансе', () => {
    expect(svc.shortfallUnits(0n, 0n)).toBe(0n);
  });
});

describe('mkt.order.side.31 — заявление 1110: только недостающее, членская часть уменьшена на остаток членского кошелька', () => {
  it('в мете — якорь, сумма, членская часть; ничего лишнего', async () => {
    const svc = buildConvertService('10.0000 RUB', 'w.mkt.member', '30.0000 RUB');
    const balances = await svc.programBalances(COOP, 'orderer1');
    expect(balances).toEqual({ member: 10_0000n, share: 30_0000n });
    const plan = svc.planFunding(balances, [{ body_units: 100_0000n, fee_units: 30_0000n }]);
    const doc = await svc.generateStatement({
      coopname: COOP,
      username: 'orderer1',
      anchor_hash: 'anchor-1',
      amount_units: plan.transfer_units,
      fee_units: plan.fee_convert_units,
    });
    expect(doc.meta).toMatchObject({ registry_id: 1110, order_hash: 'anchor-1', amount: '90.0000 RUB', membership_fee: '20.0000 RUB', skip_save: false });
    expect(Object.keys(doc.meta as object).sort()).toEqual(['amount', 'coopname', 'lang', 'membership_fee', 'order_hash', 'registry_id', 'skip_save', 'username']);
  });

  it('членский кошелёк ещё не заведён (строки нет) — остаток 0', async () => {
    const svc = buildConvertService('5.0000 RUB', 'w.wal.share');
    expect(await svc.memberAvailableUnits(COOP, 'orderer1')).toBe(0n);
  });
});

describe('mkt.order.side.32 — подписанное заявление сверяется с планом по свежему балансу', () => {
  const svc = buildConvertService('0.0000 RUB');
  const expected = { anchor_hash: 'anchor-1', amount_units: 120_0000n, fee_units: 20_0000n };
  const signed = (meta: Record<string, unknown>) => ({
    ...signedDoc({ registry_id: 1110, order_hash: 'anchor-1', amount: '120.0000 RUB', membership_fee: '20.0000 RUB', ...meta }, ['orderer1']),
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
    const doc = signedDoc({ registry_id: 1110, order_hash: 'anchor-1', amount: '120.0000 RUB', membership_fee: '20.0000 RUB' }, ['someone']);
    expect(() => svc.verifySigned(doc as never, expected, 'orderer1')).toThrow(/подписано учётной записью orderer1/);
  });
});

describe('mkt.iss.side.44 — довзнос по факту: заявление 1110 и перевод convert только когда членского кошелька не хватает', () => {
  // Денежные поля заказа — голые десятичные строки, как в фикстуре: валюту
  // добавляет форматтер на выходе, а разбор сумм её не принимает.
  const orderWithFee = () => buildOrder({ total_cost: '100.0000', membership_fee: '30.0000' } as never);
  const bigFact = () => buildSaga({ fact: { actual_quantity: 12, actual_unit_price: '10.0000', fact_cost: '120.0000' } } as never);
  // Сумма в заявлении о выдаче — голая десятичная строка: она сверяется с
  // фактом через разбор числа, валюту такой разбор не принимает.
  const stmt = (total: string) => signedDoc({ registry_id: 1113, order_hash: 'h-order-1', total_amount: total }, ['orderer1']) as never;

  it('факт меньше или равен заказу — довзноса нет, заявления нет', async () => {
    const m = buildMocks({ order: orderWithFee(), sagas: [buildSaga({ fact: { actual_quantity: 5, actual_unit_price: '10.0000', fact_cost: '50.0000' } } as never)] });
    const service = buildService(m);
    expect(await service.getConvertSignablePayload(COOP, 'order-1', 'orderer1')).toBeNull();
    expect(m.convertService.generateStatement).not.toHaveBeenCalled();
  });

  it('факт больше заказа и кошельков программы хватает на доплату и довзнос — заявления нет', async () => {
    const m = buildMocks({ order: orderWithFee(), sagas: [bigFact()] });
    const service = buildService(m);
    expect(await service.getConvertSignablePayload(COOP, 'order-1', 'orderer1')).toBeNull();
  });

  it('факт больше заказа, кошельки программы пусты — заявление на доплату тела и довзнос по пропорции контракта', async () => {
    const m = buildMocks({ order: orderWithFee(), sagas: [bigFact()], memberAvailableUnits: 0n, shareAvailableUnits: 0n });
    const service = buildService(m);
    const doc = await service.getConvertSignablePayload(COOP, 'order-1', 'orderer1');
    // fact_fee = 30 × 120 / 100 = 36; довзнос = 6; доплата тела = 20 — заявление на 26, из них членский взнос 6.
    expect(doc?.meta).toMatchObject({ order_hash: 'h-order-1', amount: '26.0000 RUB', membership_fee: '6.0000 RUB' });
  });

  it('факт больше заказа, свободного паевого хватает на доплату, членского нет — заявление только на довзнос', async () => {
    const m = buildMocks({ order: orderWithFee(), sagas: [bigFact()], memberAvailableUnits: 0n });
    const service = buildService(m);
    const doc = await service.getConvertSignablePayload(COOP, 'order-1', 'orderer1');
    expect(doc?.meta).toMatchObject({ amount: '6.0000 RUB', membership_fee: '6.0000 RUB' });
  });

  it('подача заявления о выдаче без заявления 1110 при нужном довзносе — отказ, цепь не трогаем', async () => {
    const m = buildMocks({ order: orderWithFee(), sagas: [bigFact()], memberAvailableUnits: 0n, shareAvailableUnits: 0n });
    const service = buildService(m);
    stubSignatureChecks(service);
    await expect(
      service.submitStatement({ coopname: COOP, member_account: 'orderer1', order_id: 'order-1', signed_statement: stmt('120.0000'), signed_convert: null })
    ).rejects.toThrow(/заявления о переводе/);
    expect(m.chainPort.convert).not.toHaveBeenCalled();
    expect(m.chainPort.issueStmt).not.toHaveBeenCalled();
  });

  it('заявление 1110 приложено — сначала convert с Цифрового кошелька на членскую часть, затем issuestmt без документа', async () => {
    const m = buildMocks({ order: orderWithFee(), sagas: [bigFact()], memberAvailableUnits: 0n, shareAvailableUnits: 0n });
    const service = buildService(m);
    stubSignatureChecks(service);
    await service.submitStatement({
      coopname: COOP,
      member_account: 'orderer1',
      order_id: 'order-1',
      signed_statement: stmt('120.0000'),
      signed_convert: signedDoc({ registry_id: 1110, order_hash: 'h-order-1', amount: '26.0000 RUB', membership_fee: '6.0000 RUB' }, ['orderer1']) as never,
    });
    expect(m.convertService.verifySigned).toHaveBeenCalledWith(expect.anything(), { anchor_hash: 'h-order-1', amount_units: 26_0000n, fee_units: 6_0000n }, 'orderer1');
    expect(m.chainPort.convert).toHaveBeenCalledWith(expect.objectContaining({ orderer: 'orderer1', amount: '6.0000 RUB' }));
    expect(m.chainPort.convert).toHaveBeenCalledWith(expect.not.objectContaining({ from_market: expect.anything() }));
    const convertOrder = m.chainPort.convert.mock.invocationCallOrder[0];
    const stmtOrder = m.chainPort.issueStmt.mock.invocationCallOrder[0];
    expect(convertOrder).toBeLessThan(stmtOrder);
    expect(m.chainPort.issueStmt).toHaveBeenCalledWith(expect.not.objectContaining({ convert_statement: expect.anything() }));
  });

  it('обычная выдача без довзноса — convert не зовётся', async () => {
    const m = buildMocks({ order: orderWithFee(), sagas: [buildSaga({ fact: { actual_quantity: 5, actual_unit_price: '10.0000', fact_cost: '50.0000' } } as never)] });
    const service = buildService(m);
    stubSignatureChecks(service);
    await service.submitStatement({ coopname: COOP, member_account: 'orderer1', order_id: 'order-1', signed_statement: stmt('50.0000') });
    expect(m.chainPort.convert).not.toHaveBeenCalled();
    expect(m.convertService.verifySigned).not.toHaveBeenCalled();
  });
});
