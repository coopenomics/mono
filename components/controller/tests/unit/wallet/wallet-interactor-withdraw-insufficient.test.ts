/**
 * Заявление на возврат паевого взноса на сумму больше собственного остатка.
 *
 * Цепь отклоняет такой перевод ассертом «недостаточно L3-средств». Это ответ на
 * введённую пайщиком сумму, а не сбой сервера: наружу уходит понятный отказ 400,
 * запись о платеже не создаётся. Прочие ошибки цепи пробрасываются как были.
 */
import { HttpApiError } from '@coopenomics/extension-kit';

jest.mock('~/infrastructure/generator/generator.service', () => ({
  GeneratorInfrastructureService: class {},
}));
jest.mock('~/config', () => ({ config: { coopname: 'voskhod' } }));

import { WalletInteractor } from '~/application/wallet/interactors/wallet.interactor';

function makeInteractor(chainError: Error) {
  const gateway = {
    prepareWithdraw: jest.fn(async () => ({ payment_hash: 'ph' })),
    persistWithdraw: jest.fn(async () => undefined),
  };
  const walletChain = { createWithdraw: jest.fn(async () => Promise.reject(chainError)) };
  const interactor = new WalletInteractor(
    {} as never,
    walletChain as never,
    {} as never,
    {} as never,
    {} as never,
    gateway as never
  );
  return { interactor, gateway };
}

const input = {
  coopname: 'voskhod',
  username: 'cchimbdqmjan',
  quantity: 178189,
  symbol: 'RUB',
  method_id: 'm1',
  statement: {} as never,
  payment_hash: 'ph',
};

describe('WalletInteractor.createWithdraw — сумма больше остатка', () => {
  it('отказ цепи по нехватке остатка становится понятным отказом 400, платёж не пишется', async () => {
    const { interactor, gateway } = makeInteractor(
      new Error('assertion failure with message: walletop TRANSFER: недостаточно L3-средств у пайщика cchimbdqmjan на w.wal.share')
    );

    const failure = await interactor.createWithdraw(input as never).catch((e) => e);

    expect(failure).toBeInstanceOf(HttpApiError);
    expect(failure.getStatus()).toBe(400);
    expect(failure.message).toMatch(/больше доступного остатка/);
    expect(gateway.persistWithdraw).not.toHaveBeenCalled();
  });

  it('иная ошибка цепи пробрасывается как есть', async () => {
    const chainError = new Error('deadline exceeded');
    const { interactor, gateway } = makeInteractor(chainError);

    await expect(interactor.createWithdraw(input as never)).rejects.toBe(chainError);
    expect(gateway.persistWithdraw).not.toHaveBeenCalled();
  });
});
