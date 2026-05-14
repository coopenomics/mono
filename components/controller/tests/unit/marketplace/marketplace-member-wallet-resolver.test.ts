/**
 * Unit-тесты MarketplaceMemberWalletResolver (Story 1.5).
 *
 * Покрывают:
 *   (a) кошелёк найден → возвращается DTO с available/blocked/membership_contribution
 *       (значения из ProgramWalletDTO);
 *   (b) кошелёк не найден (PG-кеш пуст, пайщик ещё не открывал main wallet)
 *       → NotFoundException, чтобы фронт повторил после доставки delta
 *       (CLAUDE.md запрещает RPC fallback);
 *   (c) поля 'available'/'blocked'/'membership_contribution' с undefined нормализуются в '0'.
 */

jest.mock('~/config/config', () => ({
  __esModule: true,
  default: { coopname: 'voskhod' },
}));

import { NotFoundException } from '@nestjs/common';
import { ProgramType } from '~/domain/wallet/enums/program-type.enum';
import { MarketplaceMemberWalletResolver } from '~/extensions/marketplace/application/resolvers/marketplace-member-wallet.resolver';

const makeWalletService = (wallet: any) =>
  ({
    getProgramWallet: jest.fn().mockResolvedValue(wallet),
  } as any);

const member = {
  username: 'alice',
  core_roles: ['User'],
  marketplace_roles: [],
};

describe('MarketplaceMemberWalletResolver', () => {
  it('кошелёк найден → DTO с available/blocked/membership_contribution', async () => {
    const walletService = makeWalletService({
      available: '125.0000 RUB',
      blocked: '5.0000 RUB',
      membership_contribution: '300.0000 RUB',
    });
    const resolver = new MarketplaceMemberWalletResolver(walletService);

    const dto = await resolver.marketplaceMemberWallet(member);

    expect(walletService.getProgramWallet).toHaveBeenCalledWith({
      coopname: 'voskhod',
      username: 'alice',
      program_type: ProgramType.MAIN,
    });
    expect(dto.username).toBe('alice');
    expect(dto.coopname).toBe('voskhod');
    expect(dto.contract).toBe('wallet');
    expect(dto.available).toBe('125.0000 RUB');
    expect(dto.blocked).toBe('5.0000 RUB');
    expect(dto.membership_contribution).toBe('300.0000 RUB');
  });

  it('кошелёк не найден → NotFoundException', async () => {
    const walletService = makeWalletService(null);
    const resolver = new MarketplaceMemberWalletResolver(walletService);

    await expect(resolver.marketplaceMemberWallet(member)).rejects.toThrow(NotFoundException);
  });

  it('поля undefined нормализуются в "0"', async () => {
    const walletService = makeWalletService({
      available: undefined,
      blocked: undefined,
      membership_contribution: undefined,
    });
    const resolver = new MarketplaceMemberWalletResolver(walletService);

    const dto = await resolver.marketplaceMemberWallet(member);

    expect(dto.available).toBe('0');
    expect(dto.blocked).toBe('0');
    expect(dto.membership_contribution).toBe('0');
  });
});
