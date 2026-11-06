/**
 * Заявление 1110 о трансляции паевого взноса из ЦПП «Цифровой Кошелёк» в ЦПП
 * «Стол заказов» (задача 99D-18): обеспечительная часть и тело позиции
 * покрываются свободным паевым «Стола заказов» — сначала обеспечительная
 * часть, затем тело; заявление — только на то, чего на нём не хватило;
 * трансляция — отдельная транзакция convert до заказа; подписанное заявление
 * сверяется с планом по свежему балансу.
 *
 * Реестр: mkt.order.side.30–32, mkt.order.side.33–34 (контракт), mkt.iss.side.44.
 */
import { BadRequestException } from '@nestjs/common';
import { MarketplaceConvertService } from '../../../src/extensions/marketplace/application/services/marketplace-convert.service';
import { COOP, buildMocks, buildOrder, buildSaga, buildService, stubSignatureChecks, signedDoc, toAsset, toUnits } from './issuance-saga.fixture';
import { Registry } from '@coopenomics/docs-templates';

const R = Registry;

function buildConvertService(shareAvailable: string, walletName = 'w.mkt.share'): MarketplaceConvertService {
  const walletRepo = {
    findByUsername: jest.fn(async () => [
      { wallet_name: walletName, available: shareAvailable, blocked: '0.0000 RUB' },
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

describe('mkt.order.side.30 — план: свободный паевой сначала на обеспечительную часть, затем на тело, недостающее — трансляцией', () => {
  const svc = buildConvertService('0.0000 RUB');

  it('свободного паевого нет — транслируется всё: тело и обеспечительная часть', () => {
    const plan = svc.planFunding({ share: 0n }, [{ body_units: 100_0000n, fee_units: 30_0000n }]);
    expect(plan.lines[0]).toMatchObject({ fee_program_units: 0n, fee_convert_units: 30_0000n, body_program_units: 0n, body_wallet_units: 100_0000n, translate_units: 130_0000n });
    expect(plan.transfer_units).toBe(130_0000n);
    expect(plan.fee_convert_units).toBe(30_0000n);
  });

  it('свободный паевой 40 — покрывает обеспечительную часть 30 и 10 тела', () => {
    const plan = svc.planFunding({ share: 40_0000n }, [{ body_units: 100_0000n, fee_units: 30_0000n }]);
    expect(plan.lines[0]).toMatchObject({ fee_program_units: 30_0000n, fee_convert_units: 0n, body_program_units: 10_0000n, body_wallet_units: 90_0000n, translate_units: 90_0000n });
    expect(plan.transfer_units).toBe(90_0000n);
    expect(plan.fee_convert_units).toBe(0n);
  });

  it('свободный паевой меньше обеспечительной части — недостающая часть транслируется вместе с телом', () => {
    const plan = svc.planFunding({ share: 10_0000n }, [{ body_units: 100_0000n, fee_units: 30_0000n }]);
    expect(plan.lines[0]).toMatchObject({ fee_program_units: 10_0000n, fee_convert_units: 20_0000n, body_program_units: 0n, body_wallet_units: 100_0000n });
    expect(plan.transfer_units).toBe(120_0000n);
  });

  it('свободного паевого хватает на всё — заявления нет', () => {
    const plan = svc.planFunding({ share: 500_0000n }, [{ body_units: 100_0000n, fee_units: 30_0000n }]);
    expect(plan.transfer_units).toBe(0n);
  });

  it('несколько строк: остаток свободного паевого тянется последовательно', () => {
    const plan = svc.planFunding({ share: 160_0000n }, [{ body_units: 100_0000n, fee_units: 30_0000n }, { body_units: 50_0000n, fee_units: 15_0000n }]);
    expect(plan.lines[0]).toMatchObject({ fee_program_units: 30_0000n, body_program_units: 100_0000n, translate_units: 0n });
    expect(plan.lines[1]).toMatchObject({ fee_program_units: 15_0000n, fee_convert_units: 0n, body_program_units: 15_0000n, body_wallet_units: 35_0000n, translate_units: 35_0000n });
    expect(plan.transfer_units).toBe(35_0000n);
  });

  it('ставка 0 — обеспечительной части нет, транслируется только недостающее тело', () => {
    const plan = svc.planFunding({ share: 0n }, [{ body_units: 100_0000n, fee_units: 0n }]);
    expect(plan.lines[0]).toMatchObject({ fee_convert_units: 0n, translate_units: 100_0000n });
  });
});

describe(`mkt.order.side.31 — заявление ${R.MarketplaceConvertStatement.registry_id}: только недостающее на свободном паевом`, () => {
  it('в мете — якорь, сумма трансляции, обеспечительная часть в ней; ничего лишнего', async () => {
    const svc = buildConvertService('10.0000 RUB');
    const balances = await svc.programBalances(COOP, 'orderer1');
    expect(balances).toEqual({ share: 10_0000n });
    const plan = svc.planFunding(balances, [{ body_units: 100_0000n, fee_units: 30_0000n }]);
    const doc = await svc.generateStatement({
      coopname: COOP,
      username: 'orderer1',
      anchor_hash: 'anchor-1',
      amount_units: plan.transfer_units,
      fee_units: plan.fee_convert_units,
    });
    expect(doc.meta).toMatchObject({ registry_id: R.MarketplaceConvertStatement.registry_id, order_hash: 'anchor-1', amount: '120.0000 RUB', membership_fee: '20.0000 RUB', skip_save: false });
    expect(Object.keys(doc.meta as object).sort()).toEqual(['amount', 'coopname', 'lang', 'membership_fee', 'order_hash', 'registry_id', 'skip_save', 'username']);
  });

  it('свободный паевой ещё не заведён (строки нет) — остаток 0', async () => {
    const svc = buildConvertService('5.0000 RUB', 'w.wal.share');
    expect(await svc.programBalances(COOP, 'orderer1')).toEqual({ share: 0n });
  });
});

describe('mkt.order.side.32 — подписанное заявление сверяется с планом по свежему балансу', () => {
  const svc = buildConvertService('0.0000 RUB');
  const expected = { anchor_hash: 'anchor-1', amount_units: 120_0000n, fee_units: 20_0000n };
  const signed = (meta: Record<string, unknown>) => ({
    ...signedDoc({ registry_id: R.MarketplaceConvertStatement.registry_id, order_hash: 'anchor-1', amount: '120.0000 RUB', membership_fee: '20.0000 RUB', ...meta }, ['orderer1']),
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

  it('обеспечительная часть разошлась при той же сумме — отказ', () => {
    expect(() => svc.verifySigned(signed({}) as never, { ...expected, fee_units: 25_0000n }, 'orderer1')).toThrow(/Обеспечительная часть/);
  });

  it('всё сошлось — возвращается document2 для контракта', () => {
    jest.spyOn(svc as never as { verifySignature: () => void }, 'verifySignature').mockImplementation(() => undefined);
    expect(svc.verifySigned(signed({}) as never, expected, 'orderer1')).toMatchObject({ hash: 'H' });
  });

  it('чужая подпись на заявлении — отказ', () => {
    const doc = signedDoc({ registry_id: R.MarketplaceConvertStatement.registry_id, order_hash: 'anchor-1', amount: '120.0000 RUB', membership_fee: '20.0000 RUB' }, ['someone']);
    expect(() => svc.verifySigned(doc as never, expected, 'orderer1')).toThrow(/подписано учётной записью orderer1/);
  });
});

describe(`mkt.iss.side.44 — доплата по факту: заявление ${R.MarketplaceConvertStatement.registry_id} и трансляция convert только когда свободного паевого не хватает`, () => {
  // Денежные поля заказа — голые десятичные строки, как в фикстуре: валюту
  // добавляет форматтер на выходе, а разбор сумм её не принимает.
  const orderWithFee = () => buildOrder({ total_cost: '100.0000', membership_fee: '30.0000' } as never);
  const bigFact = () => buildSaga({ fact: { actual_quantity: 12, actual_unit_price: '10.0000', fact_cost: '120.0000' } } as never);
  // Сумма в заявлении о выдаче — голая десятичная строка: она сверяется с
  // фактом через разбор числа, валюту такой разбор не принимает.
  const stmt = (total: string) => signedDoc({ registry_id: R.MarketplaceShareReturnStatement.registry_id, order_hash: 'h-order-1', total_amount: total }, ['orderer1']) as never;

  it('факт меньше или равен заказу — довзноса нет, заявления нет', async () => {
    const m = buildMocks({ order: orderWithFee(), sagas: [buildSaga({ fact: { actual_quantity: 5, actual_unit_price: '10.0000', fact_cost: '50.0000' } } as never)] });
    const service = buildService(m);
    expect(await service.getConvertSignablePayload(COOP, 'order-1', 'orderer1')).toBeNull();
    expect(m.convertService.generateStatement).not.toHaveBeenCalled();
  });

  it('факт больше заказа и свободного паевого хватает на доплату — заявления нет', async () => {
    const m = buildMocks({ order: orderWithFee(), sagas: [bigFact()] });
    const service = buildService(m);
    expect(await service.getConvertSignablePayload(COOP, 'order-1', 'orderer1')).toBeNull();
  });

  it('факт больше заказа, свободный паевой пуст — заявление на доплату тела и обеспечительной части по пропорции контракта', async () => {
    const m = buildMocks({ order: orderWithFee(), sagas: [bigFact()], shareAvailableUnits: 0n });
    const service = buildService(m);
    const doc = await service.getConvertSignablePayload(COOP, 'order-1', 'orderer1');
    // fact_fee = 30 × 120 / 100 = 36; доплата обеспечительной части = 6; тела = 20 — заявление на 26, из них обеспечительная часть 6.
    expect(doc?.meta).toMatchObject({ order_hash: 'h-order-1', amount: '26.0000 RUB', membership_fee: '6.0000 RUB' });
  });

  it('факт больше заказа, свободного паевого 10 — покрывает обеспечительную часть 6 и 4 тела, транслируется 16', async () => {
    const m = buildMocks({ order: orderWithFee(), sagas: [bigFact()], shareAvailableUnits: 10_0000n });
    const service = buildService(m);
    const doc = await service.getConvertSignablePayload(COOP, 'order-1', 'orderer1');
    expect(doc?.meta).toMatchObject({ amount: '16.0000 RUB', membership_fee: '0.0000 RUB' });
  });

  it(`подача заявления о выдаче без заявления ${R.MarketplaceConvertStatement.registry_id} при нужной доплате — отказ, цепь не трогаем`, async () => {
    const m = buildMocks({ order: orderWithFee(), sagas: [bigFact()], shareAvailableUnits: 0n });
    const service = buildService(m);
    stubSignatureChecks(service);
    await expect(
      service.submitStatement({ coopname: COOP, member_account: 'orderer1', order_id: 'order-1', signed_statement: stmt('120.0000'), signed_convert: null })
    ).rejects.toThrow(/заявления о трансляции/);
    expect(m.chainPort.convert).not.toHaveBeenCalled();
    expect(m.chainPort.issueStmt).not.toHaveBeenCalled();
  });

  it(`заявление ${R.MarketplaceConvertStatement.registry_id} приложено — сначала convert на всю сумму трансляции, затем issuestmt без документа`, async () => {
    const m = buildMocks({ order: orderWithFee(), sagas: [bigFact()], shareAvailableUnits: 0n });
    const service = buildService(m);
    stubSignatureChecks(service);
    await service.submitStatement({
      coopname: COOP,
      member_account: 'orderer1',
      order_id: 'order-1',
      signed_statement: stmt('120.0000'),
      signed_convert: signedDoc({ registry_id: R.MarketplaceConvertStatement.registry_id, order_hash: 'h-order-1', amount: '26.0000 RUB', membership_fee: '6.0000 RUB' }, ['orderer1']) as never,
    });
    expect(m.convertService.verifySigned).toHaveBeenCalledWith(expect.anything(), { anchor_hash: 'h-order-1', amount_units: 26_0000n, fee_units: 6_0000n }, 'orderer1');
    // Трансляция адресована своему заказу: операция ложится в нитку этого заказа,
    // а не заводит отдельную по хешу заявления (уточнение владельца 08.09.2026).
    expect(m.chainPort.convert).toHaveBeenCalledWith(expect.objectContaining({
      orderer: 'orderer1',
      targets: [{ order_hash: 'h-order-1', amount: '26.0000 RUB' }],
    }));
    expect(m.chainPort.convert).toHaveBeenCalledWith(expect.not.objectContaining({ from_market: expect.anything() }));
    const convertOrder = m.chainPort.convert.mock.invocationCallOrder[0];
    const stmtOrder = m.chainPort.issueStmt.mock.invocationCallOrder[0];
    expect(convertOrder).toBeLessThan(stmtOrder);
    expect(m.chainPort.issueStmt).toHaveBeenCalledWith(expect.not.objectContaining({ convert_statement: expect.anything() }));
  });

  // Бандл у стойки переводит доплату всех своих заказов одним заявлением 1110 до подачи
  // заявлений о выдаче. До 02.10.2026 заказ бандла с доплатой тела требовал второе
  // заявление и не подписывался вовсе (C28-85, находка 57).
  it('заказ бандла: доплата уже переведена общим заявлением — второе заявление не требуется, заявление о выдаче уходит', async () => {
    const m = buildMocks({ order: orderWithFee(), sagas: [bigFact()], shareAvailableUnits: 0n });
    const service = buildService(m);
    stubSignatureChecks(service);
    await service.submitStatement({
      coopname: COOP,
      member_account: 'orderer1',
      order_id: 'order-1',
      signed_statement: stmt('120.0000'),
      signed_convert: null,
      convert_settled_by_bundle: true,
    });
    expect(m.convertService.verifySigned).not.toHaveBeenCalled();
    expect(m.chainPort.convert).not.toHaveBeenCalled();
    expect(m.chainPort.issueStmt).toHaveBeenCalledTimes(1);
  });

  it('обычная выдача без доплаты — convert не зовётся', async () => {
    const m = buildMocks({ order: orderWithFee(), sagas: [buildSaga({ fact: { actual_quantity: 5, actual_unit_price: '10.0000', fact_cost: '50.0000' } } as never)] });
    const service = buildService(m);
    stubSignatureChecks(service);
    await service.submitStatement({ coopname: COOP, member_account: 'orderer1', order_id: 'order-1', signed_statement: stmt('50.0000') });
    expect(m.chainPort.convert).not.toHaveBeenCalled();
    expect(m.convertService.verifySigned).not.toHaveBeenCalled();
  });
});
