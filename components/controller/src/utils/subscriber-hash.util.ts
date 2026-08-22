import { createHmac } from 'crypto';
import config from '~/config/config';

/**
 * HMAC-hash для `subscriber_id`.
 *
 * Ключ — `SERVER_SECRET` кооператива (identity своя, без внешнего провайдера).
 * Hash сопровождает `subscriber_id` в профиле пользователя.
 */
export function generateSubscriberHash(subscriberId: string): string {
  const hmac = createHmac('sha256', config.server_secret);
  hmac.update(subscriberId);
  return hmac.digest('hex');
}

/** Проверка валидности subscriber-hash. */
export function validateSubscriberHash(subscriberId: string, hash: string): boolean {
  return generateSubscriberHash(subscriberId) === hash;
}
