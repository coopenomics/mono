import { assertContextHasNoSecrets } from '~/application/auth-v2/audit/audit.service';
import { mapAuthentikEvent } from '~/application/auth-v2/authentik-events.controller';

describe('auth-v2: audit blacklist', () => {
  it('пропускает чистый context', () => {
    expect(() => assertContextHasNoSecrets({ messages: ['weak'], created: 'x' })).not.toThrow();
  });

  it.each(['password', 'user_password', 'private_key', 'access_token', 'server_secret', 'signature'])(
    'бросает на ключ %s',
    (key) => {
      expect(() => assertContextHasNoSecrets({ [key]: 'value' })).toThrow(/секрет/);
    },
  );

  it('бросает на секрет во вложенном объекте', () => {
    expect(() => assertContextHasNoSecrets({ outer: { inner: { Token: 'x' } } })).toThrow(/outer\.inner\.Token/);
  });
});

describe('auth-v2: маппинг webhook authentik', () => {
  it('policy_execution + passing=false → WeakPasswordRejected', () => {
    const record = mapAuthentikEvent({
      event_action: 'policy_execution',
      passing: false,
      event_user: 'ant',
      messages: ['Пароль слишком слабый. Попробуйте длиннее или с большей вариативностью'],
      created: '2026-06-10T00:00:00Z',
    });
    expect(record).toMatchObject({
      event: 'WeakPasswordRejected',
      subjectId: 'ant',
      result: 'failure',
    });
    expect(record!.context).not.toHaveProperty('password');
  });

  it('passing=true → null (успешная проверка не аудируется как отказ)', () => {
    expect(mapAuthentikEvent({ event_action: 'policy_execution', passing: true })).toBeNull();
  });

  it('чужое событие → null', () => {
    expect(mapAuthentikEvent({ event_action: 'login', passing: false })).toBeNull();
  });

  it('пустое тело → null без падения', () => {
    expect(mapAuthentikEvent({} as never)).toBeNull();
  });
});
