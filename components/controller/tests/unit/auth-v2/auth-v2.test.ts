import { assertContextHasNoSecrets } from '~/application/auth-v2/audit/audit.service';

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
