jest.mock('~/config/config', () => ({
  __esModule: true,
  default: { coopname: 'voskhod', frontend_url: 'https://app.test' },
}));
jest.mock('@coopenomics/notifications', () => ({
  Workflows: { NewDeviceLogin: { id: 'vhod-s-novogo-ustroystva' } },
}));
// Гео — внешний сервис: в unit-тестах сеть запрещена, подставляем управляемые значения.
jest.mock('./device-description.util', () => ({
  describeUserAgent: jest.fn((ua: string | null) => (ua ? 'Chrome на macOS' : 'неизвестное устройство')),
  resolveIpLocation: jest.fn(async (ip: string | null) => (ip ? 'Москва, Россия' : null)),
}));

import { NewDeviceNotificationService } from './new-device-notification.service';

describe('NewDeviceNotificationService (Story 3.9 — уведомление о новом устройстве)', () => {
  function setup() {
    const notifications = { notify: jest.fn().mockResolvedValue({ acknowledged: true, outboxIds: ['o1'] }) };
    const users = { findUserById: jest.fn() };
    const throttle = { tryAcquire: jest.fn().mockResolvedValue(true) };
    const notMeTokens = { issue: jest.fn().mockResolvedValue('not-me-token-abc'), consume: jest.fn() };
    const service = new NewDeviceNotificationService(
      notifications as never,
      users as never,
      throttle as never,
      notMeTokens as never,
    );
    return { service, notifications, users, throttle, notMeTokens };
  }

  const verifiedUser = {
    id: 'user-uuid-1',
    username: 'ant',
    email: 'ant@coop.test',
    is_email_verified: true,
    subscriber_id: 'sub-1',
  };

  const input = { subjectId: 'user-uuid-1', username: 'ant', ip: '1.2.3.4', userAgent: 'Chrome/120' };

  it('свободное окно + verified пайщик: занимает троттл и шлёт уведомление с устройством/IP', async () => {
    const { service, notifications, users, throttle } = setup();
    users.findUserById.mockResolvedValueOnce(verifiedUser);

    await service.maybeNotify(input);

    expect(throttle.tryAcquire).toHaveBeenCalledWith('user-uuid-1');
    expect(notifications.notify).toHaveBeenCalledTimes(1);
    const payload = notifications.notify.mock.calls[0][0];
    expect(payload.workflowId).toBe('vhod-s-novogo-ustroystva');
    expect(payload.coopname).toBe('voskhod');
    expect(payload.to).toEqual({ subscriberId: 'sub-1', email: 'ant@coop.test', username: 'ant' });
    expect(payload.payload.device).toBe('Chrome на macOS');
    expect(payload.payload.location).toBe('Москва, Россия');
    expect(payload.payload.summary).toBe('Chrome на macOS · Москва, Россия');
    expect(payload.payload.ip).toBe('1.2.3.4');
    expect(payload.payload.securityUrl).toBe('https://app.test/#/voskhod/user/settings');
    expect(typeof payload.payload.time).toBe('string');
  });

  it('письмо несёт one-click ссылку «Это не я» с выпущенным токеном (Story 3.10)', async () => {
    const { service, notifications, users, notMeTokens } = setup();
    users.findUserById.mockResolvedValueOnce(verifiedUser);

    await service.maybeNotify(input);

    expect(notMeTokens.issue).toHaveBeenCalledWith('user-uuid-1');
    expect(notifications.notify.mock.calls[0][0].payload.notMeUrl).toBe('https://app.test/#/voskhod/security/not-me/not-me-token-abc');
  });

  it('bundling NFR10: окно занято (троттл false) → уведомление НЕ шлётся и пользователь не резолвится', async () => {
    const { service, notifications, users, throttle } = setup();
    throttle.tryAcquire.mockResolvedValueOnce(false);

    await service.maybeNotify(input);

    expect(notifications.notify).not.toHaveBeenCalled();
    expect(users.findUserById).not.toHaveBeenCalled();
  });

  it('email не подтверждён: email-поле опускается (in-app по subscriber_id всё равно идёт)', async () => {
    const { service, notifications, users } = setup();
    users.findUserById.mockResolvedValueOnce({ ...verifiedUser, is_email_verified: false });

    await service.maybeNotify(input);

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

    await service.maybeNotify(input);

    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it('null UA/IP: подставляются человекочитаемые заглушки в payload', async () => {
    const { service, notifications, users } = setup();
    users.findUserById.mockResolvedValueOnce(verifiedUser);

    await service.maybeNotify({ subjectId: 'user-uuid-1', username: 'ant', ip: null, userAgent: null });

    const payload = notifications.notify.mock.calls[0][0].payload;
    expect(payload.device).toBe('неизвестное устройство');
    expect(payload.ip).toBe('неизвестен');
  });

  it('best-effort: сбой notify не пробрасывается (вход не падает)', async () => {
    const { service, notifications, users } = setup();
    users.findUserById.mockResolvedValueOnce(verifiedUser);
    notifications.notify.mockRejectedValueOnce(new Error('outbox down'));

    await expect(service.maybeNotify(input)).resolves.toBeUndefined();
  });
});
