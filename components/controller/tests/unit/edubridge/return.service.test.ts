/**
 * Кошелёк программы «Образование»: отдельного выхода из программы нет, остаток
 * возвращается в паевой только при выходе из кооператива. Сервис лишь считает,
 * что вернётся сегодня: остаток кошелька плюс возврат по действующим подпискам.
 */
import { EdubridgeReturnService } from '~/extensions/edubridge/application/services/edubridge-return.service';

jest.mock('@coopenomics/extension-kit', () => ({
  ...jest.requireActual('@coopenomics/extension-kit'),
  platformSettings: () => ({ coopname: 'voskhod', blockchain: { rootGovernSymbol: 'RUB' } }),
}));

/** Пайщик: 1000 на кошельке программы и одна действующая подписка, по которой сегодня вернут 250. */
function make(opts: { available?: string | null; subscriptions?: number; refunds?: number } = {}) {
  const subscriptions = opts.subscriptions ?? 1;
  const refunds = opts.refunds ?? 250;
  const enrollments = {
    refundsOnExit: jest.fn(async () => ({ subscriptions, refunds: subscriptions ? refunds : 0 })),
  } as any;
  const wallet = opts.available === null ? null : { available: opts.available ?? '1000.0000 RUB' };
  const wallets = { findByWalletAndUsername: jest.fn(async () => wallet) } as any;
  const service = new EdubridgeReturnService(enrollments, wallets);
  return { service, enrollments, wallets };
}

describe('EdubridgeReturnService — остаток кошелька программы', () => {
  it('баланс показывает, что уйдёт в паевой сегодня: остаток плюс возврат по подпискам', async () => {
    const { service, wallets, enrollments } = make();
    expect(await service.balance('voskhod', 'ant')).toEqual({
      available: '1000.0000 RUB',
      refunds: '250.0000 RUB',
      total: '1250.0000 RUB',
      subscriptions: 1,
    });
    expect(wallets.findByWalletAndUsername).toHaveBeenCalledWith('voskhod', 'w.edu.member', 'ant');
    expect(enrollments.refundsOnExit).toHaveBeenCalledWith('voskhod', 'ant');
  });

  it('кошелька ещё нет и подписок нет — нулевой остаток', async () => {
    const { service } = make({ available: null, subscriptions: 0 });
    expect(await service.balance('voskhod', 'ant')).toEqual({
      available: '0.0000 RUB',
      refunds: '0.0000 RUB',
      total: '0.0000 RUB',
      subscriptions: 0,
    });
  });
});
