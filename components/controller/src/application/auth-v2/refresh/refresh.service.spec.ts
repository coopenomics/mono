import { UnauthorizedException } from '@nestjs/common';
import { tokenTypes } from '~/types/token.types';
import { RefreshService } from './refresh.service';

function build(overrides: { tokens?: any; userDomain?: any } = {}) {
  const tokens = {
    verifyToken: jest.fn().mockResolvedValue({ userId: 'uuid-1' }),
    findOneAndDelete: jest.fn().mockResolvedValue(null),
    generateAuthTokens: jest.fn().mockResolvedValue({ access: { token: 'A' }, refresh: { token: 'R' } }),
    ...overrides.tokens,
  };
  const userDomain = {
    findUserById: jest.fn().mockResolvedValue({ id: 'uuid-1', username: 'ant' }),
    findUserByLegacyMongoId: jest.fn().mockResolvedValue(null),
    ...overrides.userDomain,
  };
  return { svc: new RefreshService(tokens as any, userDomain as any), tokens, userDomain };
}

describe('RefreshService (Эпик 7, REST /coop/refresh)', () => {
  it('валидный refresh → ротация (старый удаляется, выпускается новая пара)', async () => {
    const { svc, tokens } = build();

    const res = await svc.refresh('refresh-token');

    expect(res).toEqual({ access_token: 'A', refresh_token: 'R' });
    expect(tokens.verifyToken).toHaveBeenCalledWith({ token: 'refresh-token', types: [tokenTypes.REFRESH] });
    expect(tokens.findOneAndDelete).toHaveBeenCalledWith('refresh-token', tokenTypes.REFRESH);
    expect(tokens.generateAuthTokens).toHaveBeenCalledWith('uuid-1');
  });

  it('пользователь только по legacy MongoId → fallback срабатывает', async () => {
    const { svc, tokens, userDomain } = build({
      userDomain: {
        findUserById: jest.fn().mockResolvedValue(null),
        findUserByLegacyMongoId: jest.fn().mockResolvedValue({ id: 'mongo-1', username: 'old' }),
      },
    });

    const res = await svc.refresh('rt');

    expect(res).toEqual({ access_token: 'A', refresh_token: 'R' });
    expect(userDomain.findUserByLegacyMongoId).toHaveBeenCalled();
    expect(tokens.generateAuthTokens).toHaveBeenCalledWith('mongo-1');
  });

  it('невалидный/отозванный refresh (verifyToken бросает) → UnauthorizedException', async () => {
    const { svc } = build({ tokens: { verifyToken: jest.fn().mockRejectedValue(new Error('not found')) } });
    await expect(svc.refresh('bad')).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('пользователь не найден ни по UUID, ни по legacy → UnauthorizedException', async () => {
    const { svc } = build({
      userDomain: {
        findUserById: jest.fn().mockResolvedValue(null),
        findUserByLegacyMongoId: jest.fn().mockResolvedValue(null),
      },
    });
    await expect(svc.refresh('rt')).rejects.toBeInstanceOf(UnauthorizedException);
  });
});
