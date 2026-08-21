jest.mock('~/config/config', () => ({
  __esModule: true,
  default: { coopname: 'voskhod', frontend_url: 'https://app.test' },
}));
jest.mock('@coopenomics/notifications', () => ({
  Workflows: { SecurityEvent: { id: 'sobytie-bezopasnosti-akkaunta' } },
}));

import { SecurityEventNotificationService } from './security-event-notification.service';
import { SecurityEventKind } from '~/domain/auth-v2/security-events/security-event.types';

describe('SecurityEventNotificationService (Story 3.11 — события безопасности)', () => {
  function setup() {
    const notifications = { notify: jest.fn().mockResolvedValue({ acknowledged: true, outboxIds: ['o1'] }) };
    const users = { findUserById: jest.fn() };
    const service = new SecurityEventNotificationService(notifications as never, users as never);
    return { service, notifications, users };
  }

  const verifiedUser = {
    id: 'user-uuid-1',
    username: 'ant',
    email: 'ant@coop.test',
    is_email_verified: true,
    subscriber_id: 'sub-1',
  };

  it.each([
    [SecurityEventKind.TwoFactorEnabled, 'Подключён второй фактор (2FA)'],
    [SecurityEventKind.TwoFactorDisabled, 'Отключён второй фактор (2FA)'],
    [SecurityEventKind.RecoveryStrategyChanged, 'Изменён способ восстановления доступа'],
  ])('событие %s → уведомление с заголовком "%s"', async (kind, title) => {
    const { service, notifications, users } = setup();
    users.findUserById.mockResolvedValueOnce(verifiedUser);

    await service.notify({ subjectId: 'user-uuid-1', kind, ip: '1.2.3.4' });

    expect(notifications.notify).toHaveBeenCalledTimes(1);
    const payload = notifications.notify.mock.calls[0][0];
    expect(payload.workflowId).toBe('sobytie-bezopasnosti-akkaunta');
    expect(payload.coopname).toBe('voskhod');
    expect(payload.to).toEqual({ subscriberId: 'sub-1', email: 'ant@coop.test', username: 'ant' });
    expect(payload.payload.event).toBe(title);
    expect(payload.payload.ip).toBe('1.2.3.4');
    expect(payload.payload.securityUrl).toBe('https://app.test/settings/security');
    expect(typeof payload.payload.time).toBe('string');
  });

  it('email не подтверждён: email-поле опускается (in-app по subscriber_id всё равно идёт)', async () => {
    const { service, notifications, users } = setup();
    users.findUserById.mockResolvedValueOnce({ ...verifiedUser, is_email_verified: false });

    await service.notify({ subjectId: 'user-uuid-1', kind: SecurityEventKind.TwoFactorEnabled, ip: null });

    expect(notifications.notify).toHaveBeenCalledTimes(1);
    expect(notifications.notify.mock.calls[0][0].to).toEqual({
      subscriberId: 'sub-1',
      email: undefined,
      username: 'ant',
    });
  });

  it('нет subscriber_id: уведомление пропускается (нечем адресовать)', async () => {
    const { service, notifications, users } = setup();
    users.findUserById.mockResolvedValueOnce({ ...verifiedUser, subscriber_id: '' });

    await service.notify({ subjectId: 'user-uuid-1', kind: SecurityEventKind.TwoFactorDisabled, ip: null });

    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it('null ip → подставляется человекочитаемая заглушка', async () => {
    const { service, notifications, users } = setup();
    users.findUserById.mockResolvedValueOnce(verifiedUser);

    await service.notify({ subjectId: 'user-uuid-1', kind: SecurityEventKind.RecoveryStrategyChanged, ip: null });

    expect(notifications.notify.mock.calls[0][0].payload.ip).toBe('неизвестен');
  });

  it('best-effort: сбой notify не пробрасывается (операция не падает)', async () => {
    const { service, notifications, users } = setup();
    users.findUserById.mockResolvedValueOnce(verifiedUser);
    notifications.notify.mockRejectedValueOnce(new Error('outbox down'));

    await expect(
      service.notify({ subjectId: 'user-uuid-1', kind: SecurityEventKind.TwoFactorEnabled, ip: '1.2.3.4' }),
    ).resolves.toBeUndefined();
  });
});
