/**
 * Порты контура, которые запрашивает расширение «Благорост».
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
  CANDIDATE_PORT,
  CHAIN_PORT,
  COUNCIL_PORT,
  DECISION_TRACKING_PORT,
  DESKTOP_GRANTS_REGISTRY_PORT,
  DOCUMENT_PORT,
  EXPENSE_CHASSIS_PORT,
  FREE_DECISION_PORT,
  INTEGRATION_SETTINGS_PORT,
  LOGGER_PORT,
  MATRIX_ROOM_MESSAGING_PORT,
  MUTATION_LOG_PORT,
  ONBOARDING_STEP_REGISTRY_PORT,
  PROGRAM_WALLET_PORT,
  PROJECT_COMMUNICATION_ARTIFACTS_PORT,
  REGISTRATION_DOCUMENT_PARAMETERS_REGISTRY_PORT,
  REGISTRATION_REGISTRY_PORT,
  SECRET_CIPHER_PORT,
  USER_DATA_PORT,
  USER_DIRECTORY_PORT,
  VAULT_PORT,
} from '@coopenomics/innercoop';

export const capitalPorts = {
  required: [
    ACCOUNT_PORT,
    CANDIDATE_PORT,
    CHAIN_PORT,
    COUNCIL_PORT,
    DECISION_TRACKING_PORT,
    DESKTOP_GRANTS_REGISTRY_PORT,
    DOCUMENT_PORT,
    EXPENSE_CHASSIS_PORT,
    FREE_DECISION_PORT,
    INTEGRATION_SETTINGS_PORT,
    LOGGER_PORT,
    MUTATION_LOG_PORT,
    ONBOARDING_STEP_REGISTRY_PORT,
    PROGRAM_WALLET_PORT,
    REGISTRATION_DOCUMENT_PARAMETERS_REGISTRY_PORT,
    REGISTRATION_REGISTRY_PORT,
    SECRET_CIPHER_PORT,
    USER_DATA_PORT,
    USER_DIRECTORY_PORT,
    VAULT_PORT,
  ],
  optional: [
    MATRIX_ROOM_MESSAGING_PORT,
    PROJECT_COMMUNICATION_ARTIFACTS_PORT,
  ],
};
