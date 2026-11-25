import { Injectable } from '@nestjs/common';
import type { IAccessTokenPort, InnerAccessIdentity } from '@coopenomics/innercoop';
import { resolveAccessTokenUser } from '~/infrastructure/graphql/ws-auth.registry';

/**
 * Реализация `IAccessTokenPort`: опознание пайщика тем же путём, что у
 * запросов ядра и ws-соединений (`resolveAccessTokenUser`).
 *
 * Наружу отдаются три поля учётной записи. Остальное (почта, ключ, внутренний
 * идентификатор) приложению каталога для проверки прав не требуется, и
 * раскрывать это чужому коду незачем.
 */
@Injectable()
export class AccessTokenInnercoopAdapter implements IAccessTokenPort {
  async identify(token: string): Promise<InnerAccessIdentity | null> {
    if (typeof token !== 'string' || token.length === 0) return null;
    const resolved = await resolveAccessTokenUser(token.replace(/^Bearer\s+/i, ''));
    if ('rejected' in resolved) return null;
    const user = resolved.user as Record<string, unknown> | null;
    const username = user?.username;
    if (typeof username !== 'string' || username.length === 0) return null;
    return { username, role: String(user?.role ?? ''), status: String(user?.status ?? '') };
  }
}
