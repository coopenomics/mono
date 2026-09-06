/**
 * Порты контура, которые запрашивает расширение «Робот совета» (ADR-16).
 *
 * Обязательные проверяются при запуске: без ключа кооператива в хранилище,
 * доступа к цепи, фабрики документов и шифра секретов робот не работает вовсе.
 */
import {
  ACCOUNT_PORT,
  CHAIN_PORT,
  DESKTOP_GRANTS_REGISTRY_PORT,
  DOCUMENT_PORT,
  EXTENSION_CONFIG_PORT,
  LOGGER_PORT,
  NOTIFICATION_PORT,
  SECRET_CIPHER_PORT,
  VAULT_PORT,
} from '@coopenomics/innercoop';

export const sovietRobotPorts = {
  required: [
    ACCOUNT_PORT,
    CHAIN_PORT,
    DESKTOP_GRANTS_REGISTRY_PORT,
    DOCUMENT_PORT,
    EXTENSION_CONFIG_PORT,
    LOGGER_PORT,
    SECRET_CIPHER_PORT,
    VAULT_PORT,
  ],
  optional: [
    NOTIFICATION_PORT,
  ],
};
