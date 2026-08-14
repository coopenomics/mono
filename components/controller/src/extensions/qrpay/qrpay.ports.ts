/**
 * Порты контура, которые запрашивает расширение «Оплата по QR».
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
  ORGANIZATION_PORT,
  PAYMENT_METHOD_PORT,
  PAYMENT_PORT,
  PAYMENT_PROVIDER_REGISTRY_PORT,
} from '@coopenomics/innercoop';

export const qrpayPorts = {
  required: [
    LOGGER_PORT,
    ORGANIZATION_PORT,
    PAYMENT_METHOD_PORT,
    PAYMENT_PORT,
    PAYMENT_PROVIDER_REGISTRY_PORT,
  ],
  optional: [
  ],
};
