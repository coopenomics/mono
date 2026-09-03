/**
 * Порты контура, которые запрашивает расширение «Образовательный мост».
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
  CHAIN_PORT,
  COUNCIL_PORT,
  DECISION_TRACKING_PORT,
  DOCUMENT_PORT,
  FREE_DECISION_PORT,
  DESKTOP_GRANTS_FILTER_REGISTRY_PORT,
  DESKTOP_GRANTS_REGISTRY_PORT,
  EXTENSION_CONFIG_PORT,
  FILE_STORAGE_PORT,
  LOGGER_PORT,
  NOTIFICATION_PORT,
  ONBOARDING_STEP_REGISTRY_PORT,
  PROGRAM_AGREEMENT_PORT,
  REGISTRATION_DOCUMENT_PARAMETERS_REGISTRY_PORT,
  REGISTRATION_OFFER_FILTER_REGISTRY_PORT,
  REGISTRATION_REGISTRY_PORT,
  SECRET_CIPHER_PORT,
  USER_CERTIFICATE_PORT,
  USER_DATA_PORT,
  USER_DIRECTORY_PORT,
  USER_WALLET_PORT,
  VAULT_PORT,
} from '@coopenomics/innercoop';

export const edubridgePorts = {
  required: [
    CHAIN_PORT,
    COUNCIL_PORT,
    DECISION_TRACKING_PORT,
    DOCUMENT_PORT,
    FREE_DECISION_PORT,
    DESKTOP_GRANTS_FILTER_REGISTRY_PORT,
    DESKTOP_GRANTS_REGISTRY_PORT,
    EXTENSION_CONFIG_PORT,
    FILE_STORAGE_PORT,
    LOGGER_PORT,
    NOTIFICATION_PORT,
    ONBOARDING_STEP_REGISTRY_PORT,
    PROGRAM_AGREEMENT_PORT,
    REGISTRATION_DOCUMENT_PARAMETERS_REGISTRY_PORT,
    REGISTRATION_OFFER_FILTER_REGISTRY_PORT,
    SECRET_CIPHER_PORT,
    USER_CERTIFICATE_PORT,
    USER_DATA_PORT,
    USER_DIRECTORY_PORT,
    USER_WALLET_PORT,
    VAULT_PORT,
  ],
  optional: [
    // Без реестра оферт расширение ставится, но свои программы и оферты
    // вступающему не предлагает.
    REGISTRATION_REGISTRY_PORT,
  ],
};
