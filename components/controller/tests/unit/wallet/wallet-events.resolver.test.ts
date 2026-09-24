/**
 * Unit-тесты открытия подписки на изменения кошелька.
 *
 * Инварианты:
 *   - ws-соединение несёт в контексте только `sub` токена: имя пайщика
 *     выводится из него, и подписка открывается на его персональный топик;
 *   - топик выбирается по токену, аргумент `coopname` только сверяется;
 *   - пайщика по токену не нашли или кооператив чужой — отказ по праву.
 *
 * До 23.09.2026 резолвер читал `user.username`, которого у ws-контекста нет:
 * подписка отклонялась на каждом соединении, и пополнение доходило до
 * карточки пайщика только дочиткой по таймеру.
 */
jest.mock('~/config/config', () => ({
  __esModule: true,
  default: { ...jest.requireActual('~/config/config').default, coopname: 'voskhod' },
}));

import { ForbiddenException } from '@nestjs/common';
import { WalletResolver } from '~/application/wallet/resolvers/wallet.resolver';
import { walletEventsTopic } from '~/application/wallet/services/wallet-events.service';

const SUB = 'f6f01eaf-81c4-4d5f-8d86-33e35e970c81';

const makeResolver = (found: { username: string } | null = { username: 'ant' }) => {
  const iterator = {} as AsyncIterator<unknown>;
  const pubSub = { asyncIterator: jest.fn().mockReturnValue(iterator) } as any;
  const userRepository = { findById: jest.fn().mockResolvedValue(found) } as any;
  const userDomainService = { getUserByLegacyMongoId: jest.fn() } as any;
  const resolver = new WalletResolver({} as any, pubSub, userRepository, userDomainService);
  return { resolver, pubSub, userRepository, iterator };
};

describe('WalletResolver.walletEvents', () => {
  it('ws-контекст с одним sub: имя пайщика выводится из токена, подписка открывается', async () => {
    const { resolver, pubSub, userRepository, iterator } = makeResolver();

    const result = await resolver.walletEvents({ sub: SUB }, { coopname: 'voskhod' } as any);

    expect(userRepository.findById).toHaveBeenCalledWith(SUB);
    expect(pubSub.asyncIterator).toHaveBeenCalledWith(walletEventsTopic('voskhod', 'ant'));
    expect(result).toBe(iterator);
  });

  it('контекст уже несёт username — берётся он, без похода в репозиторий', async () => {
    const { resolver, pubSub, userRepository } = makeResolver();

    await resolver.walletEvents({ sub: SUB, username: 'ivanov' }, { coopname: 'voskhod' } as any);

    expect(userRepository.findById).not.toHaveBeenCalled();
    expect(pubSub.asyncIterator).toHaveBeenCalledWith(walletEventsTopic('voskhod', 'ivanov'));
  });

  it('пайщика по токену не нашли — отказ по праву', async () => {
    const { resolver, pubSub } = makeResolver(null);

    await expect(resolver.walletEvents({ sub: SUB }, { coopname: 'voskhod' } as any)).rejects.toBeInstanceOf(
      ForbiddenException
    );
    expect(pubSub.asyncIterator).not.toHaveBeenCalled();
  });

  it('в токене нет ни sub, ни username — отказ по праву', async () => {
    const { resolver } = makeResolver();

    await expect(resolver.walletEvents({}, { coopname: 'voskhod' } as any)).rejects.toBeInstanceOf(
      ForbiddenException
    );
  });

  it('чужой кооператив в аргументе — отказ, топик не открывается', async () => {
    const { resolver, pubSub } = makeResolver();

    await expect(resolver.walletEvents({ sub: SUB }, { coopname: 'other' } as any)).rejects.toBeInstanceOf(
      ForbiddenException
    );
    expect(pubSub.asyncIterator).not.toHaveBeenCalled();
  });
});
