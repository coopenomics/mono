import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import { createHash } from 'node:crypto';
import { CorePortsClient } from '../ports/core-ports.client';

/** Кто сделал запрос — ответ порта `accessToken.identify` ядра. */
export interface ExtensionIdentity {
  username: string;
  role: string;
  status: string;
}

/** Сколько приложение помнит ответ ядра по одному токену. */
const IDENTITY_TTL_MS = 30_000;
const CACHE_LIMIT = 1_000;

/**
 * Проверка пайщика через ядро — вместо секрета ядра в контейнере приложения.
 *
 * Раньше приложение получало `JWT_SECRET` ядра и проверяло токен само. С
 * секретом чужой код выпускал бы токен любого пайщика, а завершённую сессию
 * продолжал бы принимать. Теперь приложение спрашивает ядро, чей это токен
 * (порт `accessToken`); ядро проверяет подпись, тип и живость сессии. Ответ
 * помнится 30 секунд: запрос пайщика не превращается в два запроса к ядру.
 *
 * Требует `ExtensionPortsModule` с портом `accessToken`.
 */
@Injectable()
export class ExtensionAccessGuard implements CanActivate {
  private readonly cache = new Map<string, { identity: ExtensionIdentity; until: number }>();

  constructor(private readonly core: CorePortsClient) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req =
      context.getType<string>() === 'graphql'
        ? GqlExecutionContext.create(context).getContext().req
        : context.switchToHttp().getRequest();
    const header: unknown = req?.headers?.authorization;
    const token = typeof header === 'string' ? header.replace(/^Bearer\s+/i, '').trim() : '';
    if (!token) throw new UnauthorizedException('Требуется вход: токен доступа не передан');

    const key = createHash('sha256').update(token).digest('hex');
    const cached = this.cache.get(key);
    let identity = cached && cached.until > Date.now() ? cached.identity : null;
    if (!identity) {
      identity = await this.core.call<ExtensionIdentity | null>('accessToken', 'identify', [token]);
      if (!identity) {
        this.cache.delete(key);
        throw new UnauthorizedException('Токен доступа не принят');
      }
      if (this.cache.size >= CACHE_LIMIT) this.cache.clear();
      this.cache.set(key, { identity, until: Date.now() + IDENTITY_TTL_MS });
    }
    req.user = identity;
    return true;
  }
}
