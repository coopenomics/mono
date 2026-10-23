/**
 * Unit-тесты открытия подписки на изменения кошелька.
 *
 * Инварианты:
 *   - пайщик берётся из контекста, как в любом резолвере: ws-соединение несёт
 *     ту же учётную запись, что HTTP-запрос (ws-auth.registry.ts), — подписка
 *     открывается на его персональный топик;
 *   - топик выбирается по токену, аргумент `coopname` только сверяется;
 *   - пайщика в контексте нет или кооператив чужой — отказ по праву.
 *
 * До 23.09.2026 ws-контекст нёс только `sub`, и резолвер, читающий `username`,
 * отклонял подписку на каждом соединении: пополнение доходило до карточки
 * пайщика только дочиткой по таймеру.
 */
jest.mock('~/config/config', () => ({
  __esModule: true,
  default: { ...jest.requireActual('~/config/config').default, coopname: 'voskhod' },
}));

import { ForbiddenException } from '@nestjs/common';
import { WalletResolver } from '~/application/wallet/resolvers/wallet.resolver';
import { walletEventsTopic } from '~/application/wallet/services/wallet-events.service';

const makeResolver = () => {
  const iterator = {} as AsyncIterator<unknown>;
  const pubSub = { asyncIterator: jest.fn().mockReturnValue(iterator) } as any;
  const resolver = new WalletResolver({} as any, pubSub);
  return { resolver, pubSub, iterator };
};

describe('WalletResolver.walletEvents', () => {
  it('пайщик из контекста — подписка открывается на его персональный топик', () => {
    const { resolver, pubSub, iterator } = makeResolver();

    const result = resolver.walletEvents({ username: 'ant' }, { coopname: 'voskhod' } as any);

    expect(pubSub.asyncIterator).toHaveBeenCalledWith(walletEventsTopic('voskhod', 'ant'));
    expect(result).toBe(iterator);
  });

  it('в контексте нет пайщика — отказ по праву, топик не открывается', () => {
    const { resolver, pubSub } = makeResolver();

    expect(() => resolver.walletEvents({}, { coopname: 'voskhod' } as any)).toThrow(ForbiddenException);
    expect(pubSub.asyncIterator).not.toHaveBeenCalled();
  });

  it('чужой кооператив в аргументе — отказ, топик не открывается', () => {
    const { resolver, pubSub } = makeResolver();

    expect(() => resolver.walletEvents({ username: 'ant' }, { coopname: 'other' } as any)).toThrow(
      ForbiddenException
    );
    expect(pubSub.asyncIterator).not.toHaveBeenCalled();
  });
});
