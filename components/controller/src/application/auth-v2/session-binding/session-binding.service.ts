import { randomUUID } from 'node:crypto';
import { Inject, Injectable } from '@nestjs/common';
import { SignJWT } from 'jose';
import config from '~/config/config';
import { REDIS_PORT } from '~/domain/common/ports/redis.port';
import type { RedisPort } from '~/domain/common/ports/redis.port';

export const SESSION_BINDING_TTL_SEC = 120;
/** Redis-ключ держим чуть дольше exp токена, чтобы 1.7 мог отвергнуть свежеистёкший по jti, а не «не найти». */
const REDIS_TTL_SEC = SESSION_BINDING_TTL_SEC + 5;
const COOKIE_NAME = 'coop_session_binding';

export interface IssuedBinding {
  token: string;
  jti: string;
  cookieName: string;
  maxAgeSec: number;
}

/**
 * Выпуск session_binding_token (CoopID, вариант B): мост между этапом password
 * (authentik) и этапом timestamp-signature (controller, Story 1.7).
 * HS256 + shared secret (Docker Secret); jti кладётся в Redis single-use —
 * потребляется в 1.7 (защита от replay).
 */
@Injectable()
export class SessionBindingService {
  constructor(@Inject(REDIS_PORT) private readonly redis: RedisPort) {}

  async issue(sub: string): Promise<IssuedBinding> {
    const secret = config.authV2.sessionBindingSecret;
    if (!secret) throw new Error('AUTH_V2_SESSION_BINDING_SECRET не задан');

    const jti = randomUUID();
    const token = await new SignJWT({ stage_completed: 'password' })
      .setProtectedHeader({ alg: 'HS256' })
      .setSubject(sub)
      .setJti(jti)
      .setIssuedAt()
      .setExpirationTime(`${SESSION_BINDING_TTL_SEC}s`)
      .sign(new TextEncoder().encode(secret));

    await this.redis.setSingleUse(`coopid:binding:${jti}`, sub, REDIS_TTL_SEC);

    return { token, jti, cookieName: COOKIE_NAME, maxAgeSec: SESSION_BINDING_TTL_SEC };
  }
}
