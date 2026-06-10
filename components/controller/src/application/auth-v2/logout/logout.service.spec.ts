import { LogoutService } from './logout.service';
import { tokenTypes } from '~/types/token.types';

describe('LogoutService (Story 1.10)', () => {
  function setup() {
    const tokens = {
      findOneAndDelete: jest.fn(),
    };
    const audit = {
      record: jest.fn().mockResolvedValue(undefined),
    };
    const service = new LogoutService(tokens as never, audit as never);
    return { service, tokens, audit };
  }

  it('отзывает refresh-токен и возвращает userId как субъект', async () => {
    const { service, tokens } = setup();
    tokens.findOneAndDelete.mockResolvedValueOnce({ userId: 'user-1', type: tokenTypes.REFRESH });

    const res = await service.logout({ refreshToken: 'r1', ip: '1.2.3.4' });

    expect(tokens.findOneAndDelete).toHaveBeenCalledWith('r1', tokenTypes.REFRESH);
    expect(res.subjectId).toBe('user-1');
  });

  it('отзывает и access-токен, если передан', async () => {
    const { service, tokens } = setup();
    tokens.findOneAndDelete.mockResolvedValue({ userId: 'user-1' });

    await service.logout({ refreshToken: 'r1', accessToken: 'a1' });

    expect(tokens.findOneAndDelete).toHaveBeenCalledWith('r1', tokenTypes.REFRESH);
    expect(tokens.findOneAndDelete).toHaveBeenCalledWith('a1', tokenTypes.ACCESS);
  });

  it('идемпотентен: токена нет в БД → subjectId null, без ошибки', async () => {
    const { service, tokens } = setup();
    tokens.findOneAndDelete.mockResolvedValue(null);

    const res = await service.logout({ refreshToken: 'gone' });

    expect(res.subjectId).toBeNull();
  });

  it('пустой вызов (нет токенов) не дёргает отзыв, всё равно пишет аудит', async () => {
    const { service, tokens, audit } = setup();

    const res = await service.logout({});

    expect(tokens.findOneAndDelete).not.toHaveBeenCalled();
    expect(res.subjectId).toBeNull();
    expect(audit.record).toHaveBeenCalledWith(expect.objectContaining({ event: 'coopid.logout', result: 'success' }));
  });

  it('пишет audit coopid.logout с субъектом из отозванного токена', async () => {
    const { service, audit, tokens } = setup();
    tokens.findOneAndDelete.mockResolvedValueOnce({ userId: 'user-7' });

    await service.logout({ refreshToken: 'r1', ip: '9.9.9.9' });

    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'coopid.logout', subjectId: 'user-7', actor: 'user-7', result: 'success', ip: '9.9.9.9' }),
    );
  });

  it('сбой аудита не валит logout (safeAudit проглатывает)', async () => {
    const { service, audit, tokens } = setup();
    tokens.findOneAndDelete.mockResolvedValueOnce({ userId: 'user-1' });
    audit.record.mockRejectedValueOnce(new Error('coop-postgres down'));

    await expect(service.logout({ refreshToken: 'r1' })).resolves.toEqual({ subjectId: 'user-1' });
  });
});
