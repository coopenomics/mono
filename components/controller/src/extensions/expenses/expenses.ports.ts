/**
 * Порты контура, которые запрашивает расширение «Шасси расходов».
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
  DOCUMENT_PORT,
  FILE_STORAGE_PORT,
  LOGGER_PORT,
  NOTIFICATION_PORT,
  PAYMENT_METHOD_PORT,
  PAYMENT_PORT,
  VAULT_PORT,
} from '@coopenomics/innercoop';

export const expensesPorts = {
  required: [
    CHAIN_PORT,
    DOCUMENT_PORT,
    FILE_STORAGE_PORT,
    LOGGER_PORT,
    NOTIFICATION_PORT,
    PAYMENT_METHOD_PORT,
    PAYMENT_PORT,
    VAULT_PORT,
  ],
  optional: [
  ],
};
