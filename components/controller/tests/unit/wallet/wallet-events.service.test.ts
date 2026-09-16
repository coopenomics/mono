/**
 * Unit-тесты издателя сигналов об изменении кошелька.
 *
 * Инварианты:
 *   - дельта своего кооператива с username → сигнал в персональный топик;
 *   - чужой кооператив, снятая строка и дельта без пайщика — молчим;
 *   - в payload идут только адресные поля: суммы клиент дочитывает сам, иначе
 *     payload и запрос разойдутся.
 */
jest.mock('~/config/config', () => ({
  __esModule: true,
  default: { ...jest.requireActual('~/config/config').default, coopname: 'voskhod' },
}));

import {
  WalletEventsService,
  walletEventsTopic,
} from '~/application/wallet/services/wallet-events.service';

const deltaOf = (overrides: Record<string, unknown> = {}) =>
  ({
    present: true,
    scope: 'voskhod',
    value: { wallet_name: 'w.wal.share', username: 'ant', available: '100.0000 RUB' },
    ...overrides,
  }) as any;

const makeService = () => {
  const pubSub = { publish: jest.fn().mockResolvedValue(undefined) } as any;
  return { service: new WalletEventsService(pubSub), pubSub };
};

describe('WalletEventsService', () => {
  it('на дельту кошелька пайщика шлёт сигнал в его персональный топик', async () => {
    const { service, pubSub } = makeService();

    await service.handleUserWalletDelta(deltaOf());

    expect(pubSub.publish).toHaveBeenCalledWith(walletEventsTopic('voskhod', 'ant'), {
      walletEvents: { coopname: 'voskhod', username: 'ant', wallet_name: 'w.wal.share' },
    });
  });

  it('сумму в сигнал не кладёт — остаток клиент дочитывает сам', async () => {
    const { service, pubSub } = makeService();

    await service.handleUserWalletDelta(deltaOf());

    const payload = pubSub.publish.mock.calls[0][1].walletEvents;
    expect(payload).not.toHaveProperty('available');
    expect(payload).not.toHaveProperty('blocked');
  });

  it('дельту чужого кооператива пропускает', async () => {
    const { service, pubSub } = makeService();
    await service.handleUserWalletDelta(deltaOf({ scope: 'other' }));
    expect(pubSub.publish).not.toHaveBeenCalled();
  });

  it('снятую строку не публикует — остаток покажет та же дочитка', async () => {
    const { service, pubSub } = makeService();
    await service.handleUserWalletDelta(deltaOf({ present: false }));
    expect(pubSub.publish).not.toHaveBeenCalled();
  });

  it('дельту без пайщика пропускает — адресовать сигнал некому', async () => {
    const { service, pubSub } = makeService();
    await service.handleUserWalletDelta(deltaOf({ value: { wallet_name: 'w.wal.share' } }));
    expect(pubSub.publish).not.toHaveBeenCalled();
  });
});
