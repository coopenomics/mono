/**
 * Порты контура, которые запрашивает расширение «Стол Председателя».
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
  CHAIN_PORT,
  COOPERATIVE_VARS_PORT,
  COUNCIL_PORT,
  DECISION_TRACKING_PORT,
  DOCUMENT_PORT,
  FREE_DECISION_PORT,
  LOGGER_PORT,
  MEET_PORT,
  NOTIFICATION_PORT,
  ONBOARDING_STEP_REGISTRY_PORT,
  VAULT_PORT,
} from '@coopenomics/innercoop';

export const chairmanPorts = {
  required: [
    ACCOUNT_PORT,
    CHAIN_PORT,
    COOPERATIVE_VARS_PORT,
    COUNCIL_PORT,
    DECISION_TRACKING_PORT,
    DOCUMENT_PORT,
    FREE_DECISION_PORT,
    LOGGER_PORT,
    MEET_PORT,
    NOTIFICATION_PORT,
    ONBOARDING_STEP_REGISTRY_PORT,
    VAULT_PORT,
  ],
  optional: [
  ],
};
