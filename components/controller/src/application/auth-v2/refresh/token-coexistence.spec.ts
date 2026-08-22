import jwt from 'jsonwebtoken';
import config from '~/config/config';
import { TokenDomainService } from '~/domain/token/services/token-domain.service';
import { tokenTypes } from '~/types/token.types';

/**
 * Жёсткий инвариант Эпика 7: уже выданные legacy-токены остаются равноправными и
 * работают наравне с токенами нового контура CoopID — до логаута.
 *
 * Корень инварианта: ОБА контура (legacy `login` и auth-v2 `verify-timestamp`)
 * выпускают токены ОДНИМ `generateAuthTokens` на ОДНОМ `config.jwt.secret`, payload
 * `{sub,iat,exp,type}` — без маркера контура/issuer/версии. Один секрет валидирует
 * оба, один `verifyToken` принимает refresh любого контура. Эти тесты фиксируют, что
 * фаза фасада (bind-тело + REST refresh + клиентский handshake) НЕ внесла различия в
 * токен-машинерию: разойдись она — тест упадёт.
 */
describe('Инвариант равноправия токенов: legacy ↔ auth-v2 CoopID', () => {
  const repo: any = { create: jest.fn().mockResolvedValue({}) };
  const svc = new TokenDomainService(repo);

  it('access обоих контуров структурно идентичен и валидируется одним секретом', async () => {
    // «legacy login» и «auth-v2 verify» вызывают ОДИН и тот же generateAuthTokens —
    // эмулируем это двумя выпусками для разных пользователей.
    const legacy = await svc.generateAuthTokens('legacy-user-uuid');
    const coopid = await svc.generateAuthTokens('coopid-user-uuid');

    for (const pair of [legacy, coopid]) {
      // Один секрет валидирует токен «любого контура» — иначе бросило бы.
      const payload = jwt.verify(pair.access.token, config.jwt.secret) as Record<string, unknown>;
      expect(payload.type).toBe(tokenTypes.ACCESS);
      // Никаких contour/issuer/version — guard физически не может отличить контуры.
      expect(Object.keys(payload).sort()).toEqual(['exp', 'iat', 'sub', 'type']);
    }

    expect((jwt.verify(legacy.access.token, config.jwt.secret) as any).sub).toBe('legacy-user-uuid');
    expect((jwt.verify(coopid.access.token, config.jwt.secret) as any).sub).toBe('coopid-user-uuid');
  });

  it('refresh-токен любого контура принимается одной токен-машинерией (verifyToken)', async () => {
    const pair = await svc.generateAuthTokens('any-user-uuid');
    repo.findByTokenAndTypes = jest.fn().mockResolvedValue({ userId: 'any-user-uuid', blacklisted: false });

    const doc = await svc.verifyToken({ token: pair.refresh.token, types: [tokenTypes.REFRESH] });

    expect(doc.userId).toBe('any-user-uuid');
    expect(repo.findByTokenAndTypes).toHaveBeenCalledWith(pair.refresh.token, [tokenTypes.REFRESH]);
  });
});
