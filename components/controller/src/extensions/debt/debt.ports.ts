/**
 * Порты контура, которые запрашивает расширение «Беспроцентные займы».
 *
 * Обязательные проверяются при запуске: без любого из них расширение не
 * стартует с внятной причиной. Необязательный — лента изменений.
 */
import {
  CHAIN_CHANGES_PORT,
  CHAIN_PORT,
  DESKTOP_GRANTS_REGISTRY_PORT,
  DOCUMENT_DECLARATION_PORT,
  DOCUMENT_PORT,
  LOGGER_PORT,
  NOTIFICATION_PORT,
  PAYMENT_METHOD_PORT,
  PAYMENT_PORT,
  VAULT_PORT,
} from '@coopenomics/innercoop';

export const debtPorts = {
  required: [
    CHAIN_PORT,
    DESKTOP_GRANTS_REGISTRY_PORT,
    DOCUMENT_DECLARATION_PORT,
    DOCUMENT_PORT,
    LOGGER_PORT,
    NOTIFICATION_PORT,
    PAYMENT_METHOD_PORT,
    PAYMENT_PORT,
    VAULT_PORT,
  ],
  optional: [
    // Лента изменений: без неё столы займов живут дочиткой.
    CHAIN_CHANGES_PORT,
  ],
};
