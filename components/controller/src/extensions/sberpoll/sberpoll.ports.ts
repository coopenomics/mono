/**
 * Порты контура, которые запрашивает расширение «Сбер: опрос платежей».
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
  LOGGER_PORT,
  MESSAGE_CHANNEL_PORT,
  ORGANIZATION_PORT,
  PAYMENT_METHOD_PORT,
  PAYMENT_POLLING_STATE_PORT,
  PAYMENT_PORT,
} from '@coopenomics/innercoop';

export const sberpollPorts = {
  required: [
    LOGGER_PORT,
    MESSAGE_CHANNEL_PORT,
    ORGANIZATION_PORT,
    PAYMENT_METHOD_PORT,
    PAYMENT_POLLING_STATE_PORT,
    PAYMENT_PORT,
  ],
  optional: [
  ],
};
