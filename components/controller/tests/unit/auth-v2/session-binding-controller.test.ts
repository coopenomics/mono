import { ServiceUnavailableException, UnauthorizedException } from '@nestjs/common';
import { SessionBindingController } from '~/application/auth-v2/session-binding/session-binding.controller';
import type { IAuthnSessionPort } from '~/domain/auth-v2/ports/authn-session.port';
import type { SessionBindingService } from '~/application/auth-v2/session-binding/session-binding.service';

function makeCtl(port: Partial<IAuthnSessionPort>, binding: Partial<SessionBindingService>) {
  return new SessionBindingController(port as IAuthnSessionPort, binding as SessionBindingService);
}
const req = (cookie?: string) => ({ headers: { cookie } }) as any;
const res = () => {
  const calls: any[] = [];
  return { calls, cookie: (...a: any[]) => calls.push(a) } as any;
};

describe('SessionBindingController.bind', () => {
  it('валидная сессия → выпускает токен и ставит HTTP-only secure cookie', async () => {
    const issued = { token: 'jwt.value', jti: 'j1', cookieName: 'coop_session_binding', maxAgeSec: 120 };
    const ctl = makeCtl(
      { resolveUsername: jest.fn(async () => 'ant') },
      { issue: jest.fn(async () => issued) as any },
    );
    const r = res();
    await ctl.bind(req('authentik_session=abc'), r);
    expect(r.calls).toHaveLength(1);
    const [name, token, opts] = r.calls[0];
    expect(name).toBe('coop_session_binding');
    expect(token).toBe('jwt.value');
    expect(opts).toMatchObject({ httpOnly: true, secure: true, sameSite: 'strict', maxAge: 120000, path: '/' });
  });

  it('нет сессии → 401, cookie не ставится', async () => {
    const issue = jest.fn();
    const ctl = makeCtl({ resolveUsername: jest.fn(async () => null) }, { issue } as any);
    const r = res();
    await expect(ctl.bind(req(), r)).rejects.toBeInstanceOf(UnauthorizedException);
    expect(r.calls).toHaveLength(0);
    expect(issue).not.toHaveBeenCalled();
  });

  it('authentik недоступен (throw порта) → 503', async () => {
    const ctl = makeCtl(
      { resolveUsername: jest.fn(async () => { throw new Error('ECONNREFUSED'); }) },
      { issue: jest.fn() } as any,
    );
    await expect(ctl.bind(req('authentik_session=abc'), res())).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});
