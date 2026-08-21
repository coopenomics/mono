import { Injectable, SetMetadata } from '@nestjs/common';

/** Ключ метаданных, по которому `PolicyRegistry` находит провайдеры-политики. */
export const POLICY_HANDLER_NAME = 'coopid:policy-handler-name';

/**
 * Помечает провайдер как именованную политику Layer 3 (Story 6.3). Класс становится
 * `@Injectable` и регистрируется в `PolicyRegistry` под именем `name`. Имя должно
 * совпадать с `IPolicyHandler.name` и со ссылкой в `@CheckAbility(..., { policy: name })`.
 *
 * @example
 * `@PolicyHandler('same-coop-voting')`
 * `export class SameCoopVotingPolicy implements IPolicyHandler { ... }`
 */
export function PolicyHandler(name: string): ClassDecorator {
  return (target) => {
    Injectable()(target);
    SetMetadata(POLICY_HANDLER_NAME, name)(target);
  };
}
