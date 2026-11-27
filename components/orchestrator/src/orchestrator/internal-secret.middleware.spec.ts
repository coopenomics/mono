/**
 * Служебные маршруты оркестратора принимают только секрет узла (487-37):
 * оркестратор виден из сети приложений.
 */
import { UnauthorizedException } from '@nestjs/common';
import { InternalSecretMiddleware } from './internal-secret.middleware';

function call(secret: string | undefined, header: unknown): { passed: boolean; error?: unknown } {
  const before = process.env.SERVER_SECRET;
  if (secret === undefined) delete process.env.SERVER_SECRET;
  else process.env.SERVER_SECRET = secret;
  try {
    const middleware = new InternalSecretMiddleware();
    let passed = false;
    try {
      middleware.use({ headers: { 'server-secret': header } } as never, {} as never, () => {
        passed = true;
      });
      return { passed };
    } catch (error) {
      return { passed, error };
    }
  } finally {
    if (before === undefined) delete process.env.SERVER_SECRET;
    else process.env.SERVER_SECRET = before;
  }
}

describe('InternalSecretMiddleware', () => {
  it('happy: запрос с секретом узла проходит', () => {
    expect(call('node-secret', 'node-secret')).toEqual({ passed: true });
  });

  it('break: без секрета, с чужим секретом и с секретом другой длины — отказ 401', () => {
    for (const header of [undefined, 'чужой', 'node-secret-x', ['node-secret']]) {
      const out = call('node-secret', header);
      expect(out.passed).toBe(false);
      expect(out.error).toBeInstanceOf(UnauthorizedException);
    }
  });

  it('side: у узла секрет не задан — маршруты открыты, как до правила', () => {
    expect(call(undefined, undefined)).toEqual({ passed: true });
  });
});
