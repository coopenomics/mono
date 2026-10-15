import type { EdubridgeRoleFacts } from './edubridge-roles.mapper';

/**
 * Факты о пайщике, из которых выводятся роли приложения. Источник истины —
 * подписанные оферты (через порты ядра) и таблица администраторов; провайдер
 * грантов о способе их получения не знает.
 */
export interface IEdubridgeRoleFactsPort {
  resolve(coopname: string, username: string): Promise<EdubridgeRoleFacts>;
}

export const EDUBRIDGE_ROLE_FACTS_PORT = Symbol('EDUBRIDGE_ROLE_FACTS_PORT');
