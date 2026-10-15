import { ForbiddenException } from '@nestjs/common';
import config from '~/config/config';
import { WalletResolver } from './wallet.resolver';
import { walletEventsTopic } from '../services/wallet-events.service';

/**
 * Подписка на изменения кошелька (C28-77). Топик персональный и строится
 * только по имени аккаунта из аутентифицированного ws-соединения: аргументов,
 * которыми можно было бы указать чужой кошелёк, у подписки нет.
 */
describe('WalletResolver.walletEvents', () => {
  const asyncIterator = jest.fn((topic: string) => ({ topic }) as unknown as AsyncIterator<unknown>);
  const resolver = new WalletResolver({} as never, { asyncIterator } as never);

  beforeEach(() => asyncIterator.mockClear());

  it('пайщик получает поток только своего кошелька — топик из имени в соединении', () => {
    resolver.walletEvents({ username: 'ant' }, { coopname: config.coopname });
    expect(asyncIterator).toHaveBeenCalledWith(walletEventsTopic(config.coopname, 'ant'));
  });

  it('соединение без имени аккаунта — отказ, поток не открывается', () => {
    expect(() => resolver.walletEvents({}, { coopname: config.coopname })).toThrow(ForbiddenException);
    expect(() => resolver.walletEvents(undefined as never, { coopname: config.coopname })).toThrow(ForbiddenException);
    expect(asyncIterator).not.toHaveBeenCalled();
  });

  it('чужой кооператив — отказ', () => {
    expect(() => resolver.walletEvents({ username: 'ant' }, { coopname: `${config.coopname}x` })).toThrow(ForbiddenException);
    expect(asyncIterator).not.toHaveBeenCalled();
  });
});
