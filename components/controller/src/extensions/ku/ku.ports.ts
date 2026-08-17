/**
 * Порты контура, которые запрашивает расширение «Кооперативные участки».
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
  BRANCH_PORT,
  CHAIN_PORT,
  DOCUMENT_PORT,
  INDIVIDUAL_PORT,
  LOGGER_PORT,
  NOTIFICATION_PORT,
  ORGANIZATION_PORT,
  PAYMENT_METHOD_PORT,
  VAULT_PORT,
} from '@coopenomics/innercoop';

export const kuPorts = {
  required: [
    ACCOUNT_PORT,
    BRANCH_PORT,
    CHAIN_PORT,
    DOCUMENT_PORT,
    INDIVIDUAL_PORT,
    LOGGER_PORT,
    NOTIFICATION_PORT,
    ORGANIZATION_PORT,
    PAYMENT_METHOD_PORT,
    VAULT_PORT,
  ],
  optional: [
  ],
};
