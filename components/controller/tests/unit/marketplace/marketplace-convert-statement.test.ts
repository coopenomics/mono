/**
 * Заявление 1110 о трансляции паевого взноса из ЦПП «Цифровой Кошелёк» в ЦПП
 * «Стол заказов» (задача 99D-18): обеспечительная часть и тело позиции
 * покрываются свободным паевым «Стола заказов» — сначала обеспечительная
 * часть, затем тело; заявление — только на то, чего на нём не хватило;
 * трансляция — отдельная транзакция convert до заказа; подписанное заявление
 * сверяется с планом по свежему балансу.
 *
 * Реестр: mkt.order.side.30–32, mkt.order.side.33–34 (контракт), mkt.iss.side.44 (доплаты по заказу нет).
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

describe('mkt.iss.side.44 — доплаты по заказу нет: сумма выдачи не выше стоимости заказа', () => {
  // Решение владельца 07.11.2026: приёмка и выдача не берут дороже и больше
  // заказа, имущество сверх заказа идёт докладкой из остатка. До 07.11.2026
  // здесь проверялись заявление 1110 и трансляция на доплату по факту.
  const stmt = (total: string) => signedDoc({ registry_id: R.MarketplaceShareReturnStatement.registry_id, order_hash: 'h-order-1', total_amount: total }, ['orderer1']) as never;
  const fix = (service: any, actual_quantity: number, actual_unit_price: string) =>
    service.fixFact({ coopname: COOP, operator_account: 'chairkrg', order_id: 'order-1', actual_quantity, actual_unit_price });

  it('факт дороже заказа — отказ на фиксации факта, заявление не формируется', async () => {
    // 10 × 100 = 1000 при стоимости заказа 500.
    const m = buildMocks({ order: buildOrder({ total_cost: '500.0000' } as never) });
    await expect(fix(buildService(m), 10, '100.0000')).rejects.toThrow(/выше стоимости заказа/);
    expect(m.documentPort.generate).not.toHaveBeenCalled();
  });

  it('факт равен заказу — факт принимается', async () => {
    const m = buildMocks();
    await expect(fix(buildService(m), 10, '100.0000')).resolves.toBeDefined();
  });

  it('подача заявления о выдаче — без трансляции convert, сразу issuestmt', async () => {
    const m = buildMocks({ sagas: [buildSaga({ fact: { actual_quantity: 5, actual_unit_price: '10.0000', fact_cost: '50.0000' } } as never)] });
    const service = buildService(m);
    stubSignatureChecks(service);
    await service.submitStatement({ coopname: COOP, member_account: 'orderer1', order_id: 'order-1', signed_statement: stmt('50.0000') });
    expect(m.chainPort.convert).not.toHaveBeenCalled();
    expect(m.chainPort.issueStmt).toHaveBeenCalledTimes(1);
  });
});
