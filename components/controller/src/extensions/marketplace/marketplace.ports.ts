/**
 * Порты контура, которые запрашивает расширение «Стол заказов».
 *
 * Это его capability-заявка (ADR-16): что расширению вообще позволено просить
 * у кооператива. Права пайщика тут ни при чём — они проверяются на границе API
 * самого расширения; здесь речь о другом вопросе: какие данные и действия
 * контура доступны этому расширению как таковому.
 *
 * Обязательные порты проверяются при запуске расширения: отсутствие любого —
 * отказ с внятной причиной, а не молчаливое падение на первом вызове.
 * Необязательные могут отсутствовать: без них часть возможностей выключена.
 */
import {
  ACCOUNT_PORT,
  AGREEMENT_CATALOG_PORT,
  BRANCH_PORT,
  CHAIN_PORT,
  COUNCIL_PORT,
  DESKTOP_GRANTS_REGISTRY_PORT,
  DOCUMENT_PORT,
  EXPENSE_CHASSIS_PORT,
  EXTENSION_CONFIG_PORT,
  EXTENSION_DATABASE_PORT,
  FILE_STORAGE_PORT,
  INTEGRATION_SETTINGS_PORT,
  LEDGER2_HISTORY_PORT,
  LOGGER_PORT,
  NOTIFICATION_PORT,
  ONBOARDING_STEP_REGISTRY_PORT,
  ORGANIZATION_PORT,
  PAYMENT_DESK_PORT,
  PAYMENT_METHOD_PORT,
  PROGRAM_AGREEMENT_PORT,
  REALTIME_CHANNEL_PORT,
  REGISTRATION_DOCUMENT_PARAMETERS_REGISTRY_PORT,
  REGISTRATION_REGISTRY_PORT,
  USER_CERTIFICATE_PORT,
  USER_DATA_PORT,
  USER_DIRECTORY_PORT,
  USER_WALLET_PORT,
  VAULT_PORT,
} from '@coopenomics/innercoop';

export const marketplacePorts = {
  required: [
    ACCOUNT_PORT,
    AGREEMENT_CATALOG_PORT,
    BRANCH_PORT,
    CHAIN_PORT,
    COUNCIL_PORT,
    DESKTOP_GRANTS_REGISTRY_PORT,
    DOCUMENT_PORT,
    EXPENSE_CHASSIS_PORT,
    EXTENSION_CONFIG_PORT,
    EXTENSION_DATABASE_PORT,
    FILE_STORAGE_PORT,
    INTEGRATION_SETTINGS_PORT,
    LEDGER2_HISTORY_PORT,
    LOGGER_PORT,
    NOTIFICATION_PORT,
    ONBOARDING_STEP_REGISTRY_PORT,
    ORGANIZATION_PORT,
    PAYMENT_DESK_PORT,
    PAYMENT_METHOD_PORT,
    PROGRAM_AGREEMENT_PORT,
    REALTIME_CHANNEL_PORT,
    REGISTRATION_DOCUMENT_PARAMETERS_REGISTRY_PORT,
    USER_CERTIFICATE_PORT,
    USER_DATA_PORT,
    USER_DIRECTORY_PORT,
    USER_WALLET_PORT,
    VAULT_PORT,
  ],
  optional: [
    REGISTRATION_REGISTRY_PORT,
  ],
};
