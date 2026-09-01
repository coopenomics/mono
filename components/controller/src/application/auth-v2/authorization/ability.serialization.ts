import { createMongoAbility } from '@casl/ability';
import type { AppAbility } from './ability.types';

/**
 * Сериализация Ability для Redis-session (Story 6.1). `ability.rules` —
 * JSON-сериализуемый массив правил; `serializeAbility` кладёт его в строку для
 * session-стора, `deserializeAbility` восстанавливает Ability. Связывание со
 * session-стором и чтение Ability на каждом запросе — Story 6.4 (`AuthorizationGuard`).
 *
 * Redis (а не JWT-claim): права активной сессии должны отзываться при правке
 * `access_rules` через Redis pub/sub (Story 6.2), чего JWT-claim не позволяет.
 *
 * Позиционная упаковка (`@casl/ability/extra` packRules) для компактности — позже:
 * subpath требует `moduleResolution: bundler/node16`, а raw-rules JSON корректен и сейчас.
 */
export function serializeAbility(ability: AppAbility): string {
  return JSON.stringify(ability.rules);
}

export function deserializeAbility(packed: string): AppAbility {
  return createMongoAbility(JSON.parse(packed));
}
