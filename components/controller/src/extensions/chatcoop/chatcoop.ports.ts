/**
 * Порты контура, которые запрашивает расширение «Чат кооператива».
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
  COOPERATIVE_VARS_PORT,
  COOP_CALENDAR_EVENT_NOTIFICATION_PORT,
  INTEGRATION_SETTINGS_PORT,
  LOGGER_PORT,
  NOTIFICATION_PORT,
  PROJECT_CAPITAL_CLEARANCE_PORT,
  PROJECT_COMMUNICATION_ARTIFACTS_PORT,
  SECRET_CIPHER_PORT,
  USER_DIRECTORY_PORT,
} from '@coopenomics/innercoop';

export const chatcoopPorts = {
  required: [
    ACCOUNT_PORT,
    COOPERATIVE_VARS_PORT,
    COOP_CALENDAR_EVENT_NOTIFICATION_PORT,
    INTEGRATION_SETTINGS_PORT,
    LOGGER_PORT,
    NOTIFICATION_PORT,
    SECRET_CIPHER_PORT,
    USER_DIRECTORY_PORT,
  ],
  optional: [
    PROJECT_CAPITAL_CLEARANCE_PORT,
    PROJECT_COMMUNICATION_ARTIFACTS_PORT,
  ],
};
