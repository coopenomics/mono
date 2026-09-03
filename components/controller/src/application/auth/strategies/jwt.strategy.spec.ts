import { UnauthorizedException } from '@nestjs/common';
import { tokenTypes } from '~/types/token.types';
import { JwtAuthStrategy } from './jwt.strategy';

/**
 * Завершение сессии обязано отбирать доступ.
 *
 * До появления claim'а `sid` этого не происходило: отзыв удалял строку refresh-токена,
 * а access-токен ни с чем не связан и продолжал работать до истечения срока — в
 * поставочной конфигурации это сотни дней. Кнопка «Завершить» была декоративной.
 */
/** `sub` обязан быть UUID либо legacy ObjectId — иначе резолвер отвергнет его форматом. */
const SUB = '11111111-1111-4111-8111-111111111111';

const USER = {
  id: SUB,
  username: 'ant',
  status: 'active',
  message: null,
  is_registered: true,
  has_account: true,
  type: 'individual',
  public_key: 'PUB',
  referer: '',
  email: 'ant@example.org',
  role: 'user',
  is_email_verified: true,
  subscriber_id: null,
  subscriber_hash: null,
};

function setup(opts: { migrated?: boolean } = {}) {
  const userRepository = { findById: jest.fn().mockResolvedValue(USER) };
  const userDomainService = { getUserByLegacyMongoId: jest.fn().mockResolvedValue(USER) };
  const tokenRepository = { findById: jest.fn() };
  const vault = { retrieve: jest.fn().mockResolvedValue(opts.migrated ? { ciphertext: 'x' } : null) };
  // След активности пишется на каждом авторизованном запросе (fire-and-forget).
  const activity = { markActive: jest.fn().mockResolvedValue(undefined) };
  const strategy = new JwtAuthStrategy(
    userRepository as never,
    userDomainService as never,
    tokenRepository as never,
    vault as never,
    activity as never,
  );
  return { strategy, tokenRepository, vault, activity };
}

const ACCESS = { sub: SUB, type: tokenTypes.ACCESS };

describe('JwtAuthStrategy — привязка токена к сессии', () => {
  it('сессия жива → пускает', async () => {
    const { strategy, tokenRepository } = setup();
    tokenRepository.findById.mockResolvedValue({ id: 'sess-1', blacklisted: false });

    const res = await strategy.validate({ ...ACCESS, sid: 'sess-1' });

    expect(tokenRepository.findById).toHaveBeenCalledWith('sess-1');
    expect(res.username).toBe('ant');
    expect(res.session_id).toBe('sess-1');
  });

  it('сессия завершена (строки нет) → отказ', async () => {
    const { strategy, tokenRepository } = setup();
    tokenRepository.findById.mockResolvedValue(null);

    await expect(strategy.validate({ ...ACCESS, sid: 'sess-gone' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('сессия в чёрном списке → отказ', async () => {
    const { strategy, tokenRepository } = setup();
    tokenRepository.findById.mockResolvedValue({ id: 'sess-1', blacklisted: true });

    await expect(strategy.validate({ ...ACCESS, sid: 'sess-1' })).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('токен старого выпуска без sid у пайщика НА КЛЮЧЕ работает как прежде — иначе выкатка разлогинит всех', async () => {
    const { strategy, tokenRepository, vault } = setup({ migrated: false });

    const res = await strategy.validate({ ...ACCESS });

    expect(tokenRepository.findById).not.toHaveBeenCalled();
    expect(vault.retrieve).toHaveBeenCalledWith({ subject_type: 'participant', subject_id: 'ant' });
    expect(res.username).toBe('ant');
    expect(res.session_id).toBeNull();
  });

  it('токен без sid у пайщика, ПЕРЕШЕДШЕГО на пароль → отказ: старые сессии обязаны умереть вместе с ключом', async () => {
    const { strategy } = setup({ migrated: true });

    await expect(strategy.validate({ ...ACCESS })).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('токен С sid у перешедшего пайщика проверяется по сессии, а не по vault — это уже новая сессия', async () => {
    const { strategy, tokenRepository, vault } = setup({ migrated: true });
    tokenRepository.findById.mockResolvedValue({ id: 'sess-new', blacklisted: false });

    const res = await strategy.validate({ ...ACCESS, sid: 'sess-new' });

    expect(vault.retrieve).not.toHaveBeenCalled();
    expect(res.session_id).toBe('sess-new');
  });

  it('ответ «перешёл» кэшируется: повторные запросы того же пайщика в vault не ходят', async () => {
    const { strategy, vault } = setup({ migrated: false });

    await strategy.validate({ ...ACCESS });
    await strategy.validate({ ...ACCESS });
    await strategy.validate({ ...ACCESS });

    expect(vault.retrieve).toHaveBeenCalledTimes(1);
  });

  it('не-access токен отвергается до всех проверок', async () => {
    const { strategy } = setup();

    await expect(strategy.validate({ sub: SUB, type: tokenTypes.REFRESH })).rejects.toThrow();
  });
});
