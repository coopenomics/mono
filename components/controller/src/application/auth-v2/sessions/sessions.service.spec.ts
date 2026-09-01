import { NotFoundException } from '@nestjs/common';
import { tokenTypes } from '~/types/token.types';
import { SESSION_DEVICE_UNKNOWN, SESSION_IP_UNKNOWN } from '~/domain/auth-v2/sessions/session.types';
import { SessionsService } from './sessions.service';

function setup() {
  const tokens = {
    findActiveByUser: jest.fn(),
    deleteById: jest.fn().mockResolvedValue(true),
  };
  const meta = { get: jest.fn(), record: jest.fn(), delete: jest.fn().mockResolvedValue(undefined) };
  const audit = { record: jest.fn().mockResolvedValue(undefined) };
  const service = new SessionsService(tokens as never, meta as never, audit as never);
  return { service, tokens, meta, audit };
}

const FUTURE = new Date(Date.now() + 86_400_000);
const PAST = new Date(Date.now() - 1000);

function row(over: Partial<{ id: string; token: string; expires: Date; blacklisted: boolean; createdAt: Date }> = {}) {
  return {
    id: over.id ?? 'sess-1',
    token: over.token ?? 'refresh-A',
    userId: 'u1',
    type: tokenTypes.REFRESH,
    expires: over.expires ?? FUTURE,
    blacklisted: over.blacklisted ?? false,
    createdAt: over.createdAt ?? new Date('2026-06-01T10:00:00.000Z'),
  };
}

describe('SessionsService (Story 3.7 — активные сессии)', () => {
  describe('list', () => {
    it('обогащает сессию метаданными устройства/IP из стора', async () => {
      const { service, tokens, meta } = setup();
      tokens.findActiveByUser.mockResolvedValueOnce([row({ id: 'sess-1', token: 'refresh-A' })]);
      meta.get.mockResolvedValueOnce({ ip: '1.2.3.4', device: 'UA/1', createdAt: '2026-06-01T10:00:00.000Z', lastSeenAt: '2026-06-02T09:00:00.000Z' });

      const res = await service.list('u1');

      expect(tokens.findActiveByUser).toHaveBeenCalledWith('u1', tokenTypes.REFRESH);
      expect(res).toEqual([
        { id: 'sess-1', device: 'UA/1', ip: '1.2.3.4', createdAt: '2026-06-01T10:00:00.000Z', lastSeenAt: '2026-06-02T09:00:00.000Z', current: false },
      ]);
    });

    it('нет метаданных → заглушки устройства/IP, lastSeenAt = createdAt', async () => {
      const { service, tokens, meta } = setup();
      tokens.findActiveByUser.mockResolvedValueOnce([row({ id: 'sess-2', createdAt: new Date('2026-06-03T08:00:00.000Z') })]);
      meta.get.mockResolvedValueOnce(null);

      const [s] = await service.list('u1');

      expect(s.device).toBe(SESSION_DEVICE_UNKNOWN);
      expect(s.ip).toBe(SESSION_IP_UNKNOWN);
      expect(s.createdAt).toBe('2026-06-03T08:00:00.000Z');
      expect(s.lastSeenAt).toBe('2026-06-03T08:00:00.000Z');
    });

    it('фильтрует истёкшие и отозванные (blacklisted) токены', async () => {
      const { service, tokens, meta } = setup();
      tokens.findActiveByUser.mockResolvedValueOnce([
        row({ id: 'ok', token: 'refresh-ok' }),
        row({ id: 'expired', token: 'refresh-exp', expires: PAST }),
        row({ id: 'revoked', token: 'refresh-bl', blacklisted: true }),
      ]);
      meta.get.mockResolvedValue(null);

      const res = await service.list('u1');

      expect(res.map((s) => s.id)).toEqual(['ok']);
    });

    it('помечает текущую сессию по совпадению refresh-токена', async () => {
      const { service, tokens, meta } = setup();
      tokens.findActiveByUser.mockResolvedValueOnce([
        row({ id: 'this', token: 'refresh-this' }),
        row({ id: 'other', token: 'refresh-other' }),
      ]);
      meta.get.mockResolvedValue(null);

      const res = await service.list('u1', 'refresh-this');

      const byId = Object.fromEntries(res.map((s) => [s.id, s.current]));
      expect(byId.this).toBe(true);
      expect(byId.other).toBe(false);
    });

    it('помечает текущую сессию по sid из access-токена', async () => {
      const { service, tokens, meta } = setup();
      tokens.findActiveByUser.mockResolvedValueOnce([
        row({ id: 'this', token: 'refresh-this' }),
        row({ id: 'other', token: 'refresh-other' }),
      ]);
      meta.get.mockResolvedValue(null);

      const res = await service.list('u1', null, 'this');

      const byId = Object.fromEntries(res.map((s) => [s.id, s.current]));
      expect(byId.this).toBe(true);
      expect(byId.other).toBe(false);
    });

    it('без sid и без refresh-токена ни одна сессия не текущая — и завершить можно любую', async () => {
      const { service, tokens, meta } = setup();
      tokens.findActiveByUser.mockResolvedValueOnce([row({ id: 'mine' })]);
      meta.get.mockResolvedValue(null);

      const res = await service.list('u1');

      expect(res[0].current).toBe(false);
    });

    it('сбой метаданных не валит список (best-effort)', async () => {
      const { service, tokens, meta } = setup();
      tokens.findActiveByUser.mockResolvedValueOnce([row()]);
      meta.get.mockRejectedValueOnce(new Error('redis down'));

      const res = await service.list('u1');

      expect(res[0].device).toBe(SESSION_DEVICE_UNKNOWN);
    });
  });

  describe('revoke', () => {
    it('удаляет токен сессии + метаданные + пишет audit', async () => {
      const { service, tokens, meta, audit } = setup();
      tokens.findActiveByUser.mockResolvedValueOnce([row({ id: 'sess-1', token: 'refresh-A' })]);

      await service.revoke('u1', 'sess-1', '5.5.5.5');

      expect(tokens.deleteById).toHaveBeenCalledWith('sess-1');
      expect(meta.delete).toHaveBeenCalledWith('refresh-A');
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'coopid.session.revoked', subjectId: 'u1', result: 'success', context: { session_id: 'sess-1' } }),
      );
    });

    it('чужая/несуществующая сессия → NotFoundException, токен не трогаем', async () => {
      const { service, tokens } = setup();
      tokens.findActiveByUser.mockResolvedValueOnce([row({ id: 'sess-1' })]);

      await expect(service.revoke('u1', 'sess-NOPE', null)).rejects.toBeInstanceOf(NotFoundException);
      expect(tokens.deleteById).not.toHaveBeenCalled();
    });
  });

  describe('revokeAll', () => {
    it('удаляет все refresh-токены пайщика и возвращает счётчик', async () => {
      const { service, tokens, meta, audit } = setup();
      tokens.findActiveByUser.mockResolvedValueOnce([
        row({ id: 's1', token: 'r1' }),
        row({ id: 's2', token: 'r2' }),
      ]);

      const res = await service.revokeAll('u1', '5.5.5.5');

      expect(res).toEqual({ revoked: 2 });
      expect(tokens.deleteById).toHaveBeenCalledWith('s1');
      expect(tokens.deleteById).toHaveBeenCalledWith('s2');
      expect(meta.delete).toHaveBeenCalledWith('r1');
      expect(meta.delete).toHaveBeenCalledWith('r2');
      expect(audit.record).toHaveBeenCalledWith(
        expect.objectContaining({ event: 'coopid.session.revoked_all', context: { revoked_count: 2 } }),
      );
    });

    it('текущую сессию не трогает — кнопка обещает «все остальные»', async () => {
      const { service, tokens, meta } = setup();
      tokens.findActiveByUser.mockResolvedValueOnce([
        row({ id: 'mine', token: 'r-mine' }),
        row({ id: 'other', token: 'r-other' }),
      ]);

      const res = await service.revokeAll('u1', null, 'mine');

      expect(res).toEqual({ revoked: 1 });
      expect(tokens.deleteById).toHaveBeenCalledWith('other');
      expect(tokens.deleteById).not.toHaveBeenCalledWith('mine');
      expect(meta.delete).not.toHaveBeenCalledWith('r-mine');
    });

    it('кроме текущей завершать нечего → не удаляет ничего', async () => {
      const { service, tokens } = setup();
      tokens.findActiveByUser.mockResolvedValueOnce([row({ id: 'mine', token: 'r-mine' })]);

      const res = await service.revokeAll('u1', null, 'mine');

      expect(res).toEqual({ revoked: 0 });
      expect(tokens.deleteById).not.toHaveBeenCalled();
    });
  });
});
