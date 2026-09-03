jest.mock('~/config/config', () => ({
  __esModule: true,
  default: { coopname: 'voskhod', frontend_url: 'https://app.test' },
}));
jest.mock('@coopenomics/notifications', () => ({
  Workflows: { ResetKey: { id: 'vosstanovlenie-dostupa' } },
}));

import { RecoveryService } from './recovery.service';

describe('RecoveryService (Story 3.1 — magic-link recovery)', () => {
  function setup() {
    const notifications = { notify: jest.fn().mockResolvedValue({ acknowledged: true, outboxIds: ['o1'] }) };
    const users = { findUserByEmail: jest.fn() };
    const tokenStore = { issue: jest.fn().mockResolvedValue(undefined), consume: jest.fn() };
    // По умолчанию email-канал активен (Story 3.5 гейтинг); тест отключения — отдельно.
    const strategy = { isChannelActive: jest.fn().mockResolvedValue(true) };
    const audit = { record: jest.fn().mockResolvedValue(undefined) };
    const service = new RecoveryService(
      notifications as never,
      users as never,
      tokenStore as never,
      strategy as never,
      audit as never,
    );
    return { service, notifications, users, tokenStore, strategy, audit };
  }

  const verifiedUser = {
    id: 'user-uuid-1',
    username: 'ant',
    email: 'ant@coop.test',
    is_email_verified: true,
    subscriber_id: 'sub-1',
  };

  it('найден verified пайщик: выпускает токен (5 мин), шлёт письмо и пишет audit', async () => {
    const { service, notifications, users, tokenStore, audit } = setup();
    users.findUserByEmail.mockResolvedValueOnce(verifiedUser);

    await service.requestByEmail('ANT@coop.test', '1.2.3.4');

    // токен положен в стор с payload пайщика и TTL 300с
    expect(tokenStore.issue).toHaveBeenCalledTimes(1);
    const [token, payload, ttl] = tokenStore.issue.mock.calls[0];
    expect(typeof token).toBe('string');
    expect(token.length).toBeGreaterThan(10);
    expect(payload).toEqual({ subjectId: 'user-uuid-1', username: 'ant', coopname: 'voskhod' });
    expect(ttl).toBe(300);

    // письмо через Центр уведомлений workflow reset-key, ссылка содержит токен
    expect(notifications.notify).toHaveBeenCalledTimes(1);
    const input = notifications.notify.mock.calls[0][0];
    expect(input.workflowId).toBe('vosstanovlenie-dostupa');
    expect(input.coopname).toBe('voskhod');
    expect(input.to).toEqual({ subscriberId: 'sub-1', email: 'ant@coop.test', username: 'ant' });
    expect(input.payload.resetUrl).toBe(`https://app.test/voskhod/auth/recover/${token}`);

    // audit без секретов
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'coopid.recovery.requested',
        subjectId: 'user-uuid-1',
        result: 'success',
        ip: '1.2.3.4',
      }),
    );
    const ctx = audit.record.mock.calls[0][0].context;
    expect(ctx).toEqual({ strategy: 'email_magic_link', email_verified: true });
    expect(JSON.stringify(ctx)).not.toContain(token);
  });

  it('email не найден: письма нет, но отказ виден в audit (анти-enumeration наружу сохранён)', async () => {
    const { service, notifications, users, tokenStore, audit } = setup();
    users.findUserByEmail.mockResolvedValueOnce(null);

    await service.requestByEmail('ghost@coop.test', '1.2.3.4');

    expect(tokenStore.issue).not.toHaveBeenCalled();
    expect(notifications.notify).not.toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        event: 'coopid.recovery.requested',
        subjectId: null,
        result: 'failure',
        context: { reason: 'user_not_found' },
        ip: '1.2.3.4',
      }),
    );
  });

  it('email НЕ подтверждён: письмо всё равно шлётся, факт зафиксирован в audit', async () => {
    // Решение 03.09.2026: верификация почты не гейтит восстановление — на проде
    // её не проходил никто, и гейт запирал единственный способ вернуть доступ.
    const { service, notifications, users, tokenStore, audit } = setup();
    users.findUserByEmail.mockResolvedValueOnce({ ...verifiedUser, is_email_verified: false });

    await service.requestByEmail('ant@coop.test', null);

    expect(tokenStore.issue).toHaveBeenCalledTimes(1);
    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        result: 'success',
        context: { strategy: 'email_magic_link', email_verified: false },
      }),
    );
  });

  it('нет subscriber_id: письмо не шлётся, причина видна в audit', async () => {
    const { service, notifications, tokenStore, users, audit } = setup();
    users.findUserByEmail.mockResolvedValueOnce({ ...verifiedUser, subscriber_id: '' });

    await service.requestByEmail('ant@coop.test', null);

    expect(tokenStore.issue).not.toHaveBeenCalled();
    expect(notifications.notify).not.toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        subjectId: 'user-uuid-1',
        result: 'failure',
        context: { reason: 'no_subscriber_id' },
      }),
    );
  });

  it('стратегия отключила email-канал (Story 3.5): письмо не шлётся, исход константен', async () => {
    const { service, notifications, users, tokenStore, strategy, audit } = setup();
    users.findUserByEmail.mockResolvedValueOnce(verifiedUser);
    strategy.isChannelActive.mockResolvedValueOnce(false);

    await service.requestByEmail('ant@coop.test', null);

    expect(tokenStore.issue).not.toHaveBeenCalled();
    expect(notifications.notify).not.toHaveBeenCalled();
    expect(audit.record).toHaveBeenCalledWith(
      expect.objectContaining({
        result: 'failure',
        context: { reason: 'email_channel_disabled' },
      }),
    );
  });

  it('падение audit на ветке отказа не роняет ручку (исход остаётся константным)', async () => {
    const { service, users, audit } = setup();
    users.findUserByEmail.mockResolvedValueOnce(null);
    audit.record.mockRejectedValueOnce(new Error('coop-postgres недоступен'));

    await expect(service.requestByEmail('ghost@coop.test', null)).resolves.toBeUndefined();
  });

  it('нормализует email перед поиском (lookup-ключ детерминирован)', async () => {
    const { service, users } = setup();
    users.findUserByEmail.mockResolvedValueOnce(null);

    await service.requestByEmail('  ANT@Coop.TEST  ', null);

    expect(users.findUserByEmail).toHaveBeenCalledWith('ant@coop.test');
  });
});
