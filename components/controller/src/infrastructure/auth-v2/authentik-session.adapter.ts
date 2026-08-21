import { Injectable } from '@nestjs/common';
import config from '~/config/config';
import { IAuthnSessionPort } from '~/domain/auth-v2/ports/authn-session.port';

/**
 * Адаптер проверки сессии authentik: GET /api/v3/core/users/me/ с проброшенной
 * сессионной cookie пайщика. 200 → username; 401/403 → null (невалидная сессия);
 * сеть/5xx → throw (отличаем недоступность IdP от «не залогинен»).
 */
@Injectable()
export class AuthentikSessionAdapter implements IAuthnSessionPort {
  async resolveUsername(sessionCookie: string): Promise<string | null> {
    if (!sessionCookie) return null;

    const res = await fetch(`${config.authV2.authentikInternalUrl}/api/v3/core/users/me/`, {
      headers: { cookie: sessionCookie, accept: 'application/json' },
    });

    if (res.status === 401 || res.status === 403) return null;
    if (!res.ok) throw new Error(`authentik me-endpoint вернул ${res.status}`);

    const data = (await res.json()) as { user?: { username?: string } };
    return data?.user?.username ?? null;
  }
}
