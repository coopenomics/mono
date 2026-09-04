import { createHash } from 'node:crypto';
import { EmailVerificationService } from './email-verification.service';

const EMAIL = 'Ivanov@Example.com';
const NORMALIZED = 'ivanov@example.com';

function sha256Hex(value: string): string {
  return createHash('sha256').update(value).digest('hex');
}

function setup(
  overrides: {
    state?: { email: string; codeHash: string; sendCount: number } | null;
    cooldown?: number;
    user?: { id: string; username: string } | null;
    attempts?: number;
    requests?: number;
    notifyFails?: boolean;
  } = {},
) {
  const store = {
    put: jest.fn().mockResolvedValue(undefined),
    get: jest.fn().mockResolvedValue(overrides.state ?? null),
    delete: jest.fn().mockResolvedValue(undefined),
    bumpAttempts: jest.fn().mockResolvedValue(overrides.attempts ?? 1),
    tryAcquireResend: jest.fn().mockResolvedValue(true),
    resendCooldown: jest.fn().mockResolvedValue(overrides.cooldown ?? 0),
    markVerified: jest.fn().mockResolvedValue(undefined),
    isVerified: jest.fn().mockResolvedValue(false),
    bumpRequests: jest.fn().mockResolvedValue(overrides.requests ?? 1),
  };
  const users = {
    findUserByEmail: jest.fn().mockResolvedValue(overrides.user ?? null),
    updateUserById: jest.fn().mockResolvedValue(undefined),
  };
  const notifications = {
    notify: overrides.notifyFails
      ? jest.fn().mockRejectedValue(new Error('smtp down'))
      : jest.fn().mockResolvedValue({ acknowledged: true, outboxIds: ['1'] }),
  };
  const service = new EmailVerificationService(store as any, users as any, notifications as any);
  return { service, store, users, notifications };
}

/** Код, которым сервис ответил на запрос: достаём из письма, как это делает пайщик. */
function codeFromNotify(notify: jest.Mock): string {
  return notify.mock.calls[0][0].payload.code;
}

describe('EmailVerificationService (подтверждение почты кодом)', () => {
  it('request: письмо уходит на нормализованный адрес, код шестизначный', async () => {
    const { service, notifications, store } = setup();
    const result = await service.request(EMAIL, '10.0.0.1');

    expect(result).toEqual({ cooldown_seconds: 60, expires_seconds: 900 });
    const call = notifications.notify.mock.calls[0][0];
    expect(call.to.email).toBe(NORMALIZED);
    expect(call.payload.code).toMatch(/^\d{6}$/);
    // Подписчика у адреса может не быть — кладём синтетический, доставка идёт по email.
    expect(call.to.subscriberId).toBe(`email:${NORMALIZED}`);
    expect(store.put).toHaveBeenCalled();
  });

  it('request: код в хранилище лежит хэшем, а не открытым текстом', async () => {
    const { service, notifications, store } = setup();
    await service.request(EMAIL, null);
    const code = codeFromNotify(notifications.notify);
    const [, state] = store.put.mock.calls[0];
    expect(state.codeHash).toBe(sha256Hex(code));
    expect(JSON.stringify(state)).not.toContain(code);
  });

  it('request: повторный запрос в окне троттла не шлёт второе письмо', async () => {
    const { service, notifications } = setup({ cooldown: 42 });
    const result = await service.request(EMAIL, null);
    expect(result.cooldown_seconds).toBe(42);
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it('request: сбой отправки не затирает действующий код', async () => {
    const { service, store } = setup({
      notifyFails: true,
      state: { email: NORMALIZED, codeHash: 'old', sendCount: 1 },
    });
    await expect(service.request(EMAIL, null)).rejects.toThrow(/Не удалось отправить письмо/);
    expect(store.put).not.toHaveBeenCalled();
  });

  it('request: превышение лимита писем на адрес — отказ', async () => {
    const { service, notifications } = setup({
      state: { email: NORMALIZED, codeHash: 'x', sendCount: 5 },
    });
    await expect(service.request(EMAIL, null)).rejects.toThrow(/Слишком много писем/);
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it('request: превышение лимита по IP — отказ до отправки', async () => {
    const { service, notifications } = setup({ requests: 21 });
    await expect(service.request(EMAIL, '10.0.0.1')).rejects.toThrow(/Слишком много запросов/);
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it('request: адрес без @ отвергается', async () => {
    const { service, notifications } = setup();
    await expect(service.request('не-почта', null)).rejects.toThrow(/корректный адрес/);
    expect(notifications.notify).not.toHaveBeenCalled();
  });

  it('confirm: верный код подтверждает адрес и ставит флаг существующему пайщику', async () => {
    const { service, store, users } = setup({
      state: { email: NORMALIZED, codeHash: sha256Hex('123456'), sendCount: 1 },
      user: { id: 'u1', username: 'ant' },
    });
    await expect(service.confirm(EMAIL, '123456')).resolves.toBe(true);
    expect(users.updateUserById).toHaveBeenCalledWith('u1', { is_email_verified: true });
    // Отметка нужна и здесь: адрес мог подтверждаться до создания учётной записи.
    expect(store.markVerified).toHaveBeenCalled();
    expect(store.delete).toHaveBeenCalled();
  });

  it('confirm: адрес без учётной записи подтверждается отметкой (шаг регистрации)', async () => {
    const { service, store, users } = setup({
      state: { email: NORMALIZED, codeHash: sha256Hex('123456'), sendCount: 1 },
      user: null,
    });
    await expect(service.confirm(EMAIL, '123456')).resolves.toBe(true);
    expect(users.updateUserById).not.toHaveBeenCalled();
    expect(store.markVerified).toHaveBeenCalled();
  });

  it('confirm: код одноразовый — состояние сжигается', async () => {
    const { service, store } = setup({
      state: { email: NORMALIZED, codeHash: sha256Hex('123456'), sendCount: 1 },
    });
    await service.confirm(EMAIL, '123456');
    expect(store.delete).toHaveBeenCalledWith(NORMALIZED);
  });

  it('confirm: неверный код — отказ, счётчик попыток растёт, флаг не ставится', async () => {
    const { service, store, users } = setup({
      state: { email: NORMALIZED, codeHash: sha256Hex('123456'), sendCount: 1 },
      user: { id: 'u1', username: 'ant' },
      attempts: 2,
    });
    await expect(service.confirm(EMAIL, '000000')).rejects.toThrow(/Неверный код/);
    expect(store.bumpAttempts).toHaveBeenCalled();
    expect(users.updateUserById).not.toHaveBeenCalled();
    expect(store.markVerified).not.toHaveBeenCalled();
  });

  it('confirm: на пятой неверной попытке код сжигается целиком', async () => {
    const { service, store } = setup({
      state: { email: NORMALIZED, codeHash: sha256Hex('123456'), sendCount: 1 },
      attempts: 5,
    });
    await expect(service.confirm(EMAIL, '000000')).rejects.toThrow(/Слишком много неверных попыток/);
    expect(store.delete).toHaveBeenCalledWith(NORMALIZED);
  });

  it('confirm: код не запрашивался — понятный отказ, а не «неверный код»', async () => {
    const { service } = setup({ state: null });
    await expect(service.confirm(EMAIL, '123456')).rejects.toThrow(/не запрашивался/);
  });

  it('isVerified: спрашивает хранилище по нормализованному адресу', async () => {
    const { service, store } = setup();
    await service.isVerified(EMAIL);
    expect(store.isVerified).toHaveBeenCalledWith(NORMALIZED);
  });
});
