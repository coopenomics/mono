import jwt from 'jsonwebtoken';
import config from '~/config/config';
import { tokenTypes } from '~/types/token.types';
import { TokenDomainService } from './token-domain.service';

/**
 * Access-токен обязан нести сессию, которой выдан (claim `sid`).
 *
 * Без этой привязки завершение сессии оставалось декоративным: строка refresh-токена
 * удалялась, а access-токен, ни с чем не связанный, открывал доступ до конца срока —
 * в поставочной конфигурации это сотни дней.
 */
function setup() {
  const created: Array<{ token: string; userId: string; type: string }> = [];
  const repo = {
    create: jest.fn(async (data: { token: string; userId: string; type: string }) => {
      created.push(data);
      return { id: 'sess-42', ...data };
    }),
    updateById: jest.fn(async (id: string, updates: Record<string, unknown>) => ({ id, ...updates })),
  };
  return { service: new TokenDomainService(repo as never), repo };
}

function decode(token: string): Record<string, unknown> {
  return jwt.verify(token, config.jwt.secret) as Record<string, unknown>;
}

describe('TokenDomainService.generateAuthTokens', () => {
  it('кладёт id сохранённой сессии в claim sid access-токена', async () => {
    const { service } = setup();

    const pair = await service.generateAuthTokens('u1');

    expect(decode(pair.access.token).sid).toBe('sess-42');
  });

  it('refresh-токен сохраняется раньше access — иначе id сессии ещё не существует', async () => {
    const { service, repo } = setup();

    await service.generateAuthTokens('u1');

    expect(repo.create).toHaveBeenCalledTimes(1);
    expect(repo.create).toHaveBeenCalledWith(expect.objectContaining({ type: tokenTypes.REFRESH }));
  });

  it('сам refresh-токен sid не несёт — сессия это он и есть', async () => {
    const { service } = setup();

    const pair = await service.generateAuthTokens('u1');

    expect(decode(pair.refresh.token).sid).toBeUndefined();
  });

  it('обновление пары сохраняет личность сессии: строка та же, sid прежний', async () => {
    const { service, repo } = setup();

    const pair = await service.rotateAuthTokens('u1', 'sess-42');

    expect(repo.create).not.toHaveBeenCalled();
    expect(repo.updateById).toHaveBeenCalledWith(
      'sess-42',
      expect.objectContaining({ token: pair.refresh.token }),
    );
    expect(decode(pair.access.token).sid).toBe('sess-42');
  });

  it('одноразовые токены сессии не имеют и sid не получают', async () => {
    const { service } = setup();

    const token = service.generateToken({
      userId: 'u1',
      expires: new Date(Date.now() + 600_000),
      type: tokenTypes.VERIFY_EMAIL,
    });

    expect(decode(token).sid).toBeUndefined();
  });
});
