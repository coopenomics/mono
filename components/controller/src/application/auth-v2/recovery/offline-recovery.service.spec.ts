jest.mock('~/config/config', () => ({ __esModule: true, default: { coopname: 'voskhod', server_secret: 'test-secret' } }));

import { createHmac } from 'node:crypto';
import { AuthV2ErrorCode } from '~/domain/auth-v2/errors/auth-v2.error';
import { OfflineRecoveryService } from './offline-recovery.service';

const USER = { id: 'u1', username: 'ant' };
// keyed-hash нормализованного кода (только цифры) — как в сервисе.
const codeHashOf = (code: string) => createHmac('sha256', 'test-secret').update(code.replace(/\D/g, '')).digest('hex');

function setup() {
  const codes = {
    findSubjectByCodeHash: jest.fn(),
    set: jest.fn().mockResolvedValue(undefined),
    consume: jest.fn().mockResolvedValue(undefined),
  };
  const users = { findUserById: jest.fn() };
  const tokenStore = { issue: jest.fn().mockResolvedValue(undefined), peek: jest.fn(), consume: jest.fn() };
  // По умолчанию offline-канал активен (Story 3.5 гейтинг); тест отключения — отдельно.
  const strategy = { isChannelActive: jest.fn().mockResolvedValue(true) };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const service = new OfflineRecoveryService(codes as never, users as never, tokenStore as never, strategy as never, audit as never);
  return { service, codes, users, tokenStore, strategy, audit };
}

describe('OfflineRecoveryService (Story 3.4 — offline-код)', () => {
  it('requestByOfflineCode: верный код → выдан токен + single-use consume + audit', async () => {
    const { service, codes, users, tokenStore, audit } = setup();
    codes.findSubjectByCodeHash.mockResolvedValueOnce('u1');
    users.findUserById.mockResolvedValueOnce(USER);

    const token = await service.requestByOfflineCode('1234-5678-9012-3456', '1.2.3.4');

    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(0);
    // lookup по keyed-hash нормализованного (без дефисов) кода
    expect(codes.findSubjectByCodeHash).toHaveBeenCalledWith(codeHashOf('1234567890123456'));
    expect(tokenStore.issue).toHaveBeenCalledWith(
      token,
      { subjectId: 'u1', username: 'ant', coopname: 'voskhod' },
      300,
    );
    expect(codes.consume).toHaveBeenCalledWith('u1'); // single-use
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({ event: 'coopid.recovery.requested', result: 'success', context: { strategy: 'offline_code' } }),
    );
  });

  it('requestByOfflineCode: неверный код → InvalidOfflineCode, без токена/consume', async () => {
    const { service, codes, tokenStore } = setup();
    codes.findSubjectByCodeHash.mockResolvedValueOnce(null);
    await expect(service.requestByOfflineCode('0000000000000000', null)).rejects.toMatchObject({
      code: AuthV2ErrorCode.InvalidOfflineCode,
    });
    expect(tokenStore.issue).not.toHaveBeenCalled();
    expect(codes.consume).not.toHaveBeenCalled();
  });

  it('requestByOfflineCode: код есть, но пайщик пропал → InvalidOfflineCode (защитно)', async () => {
    const { service, codes, users, tokenStore } = setup();
    codes.findSubjectByCodeHash.mockResolvedValueOnce('u-gone');
    users.findUserById.mockResolvedValueOnce(null);
    await expect(service.requestByOfflineCode('1111222233334444', null)).rejects.toMatchObject({
      code: AuthV2ErrorCode.InvalidOfflineCode,
    });
    expect(tokenStore.issue).not.toHaveBeenCalled();
  });

  it('audit-контекст без секретов (только strategy)', async () => {
    const { service, codes, users, audit } = setup();
    codes.findSubjectByCodeHash.mockResolvedValueOnce('u1');
    users.findUserById.mockResolvedValueOnce(USER);
    await service.requestByOfflineCode('1234567890123456', null);
    expect(audit.record.mock.calls[0][0].context).toEqual({ strategy: 'offline_code' });
  });

  it('стратегия отключила offline-канал (Story 3.5): InvalidOfflineCode, код не потреблён', async () => {
    const { service, codes, users, tokenStore, strategy } = setup();
    codes.findSubjectByCodeHash.mockResolvedValueOnce('u1');
    users.findUserById.mockResolvedValueOnce(USER);
    strategy.isChannelActive.mockResolvedValueOnce(false);
    await expect(service.requestByOfflineCode('1234567890123456', null)).rejects.toMatchObject({
      code: AuthV2ErrorCode.InvalidOfflineCode,
    });
    expect(tokenStore.issue).not.toHaveBeenCalled();
    expect(codes.consume).not.toHaveBeenCalled();
  });

  it('setForSubject: сохраняет keyed-hash кода (сейм on-boarding)', async () => {
    const { service, codes } = setup();
    await service.setForSubject('u1', '1234-5678-9012-3456');
    expect(codes.set).toHaveBeenCalledWith('u1', codeHashOf('1234567890123456'));
  });
});
