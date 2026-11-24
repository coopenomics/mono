/**
 * Порты контура, которые запрашивает приложение «Поздравления».
 *
 * Это его capability-заявка (ADR-16): что приложению позволено просить у
 * кооператива. Права пайщика проверяются на границе API приложения.
 */
import {
  ACCOUNT_PORT,
  CHAIN_CHANGES_PORT,
  COOPERATIVE_VARS_PORT,
  DESKTOP_GRANTS_REGISTRY_PORT,
  LOGGER_PORT,
  NOTIFICATION_PORT,
  USER_DIRECTORY_PORT,
} from '@coopenomics/innercoop';

export const greetingsPorts = {
  required: [
    // ФИО, тип субъекта, статус членства и дата рождения пайщика.
    ACCOUNT_PORT,
    // Название кооператива для подписи письма.
    COOPERATIVE_VARS_PORT,
    DESKTOP_GRANTS_REGISTRY_PORT,
    LOGGER_PORT,
    // Отправка письма через центр уведомлений.
    NOTIFICATION_PORT,
    // Председатель — для переменной «Председатель».
    USER_DIRECTORY_PORT,
  ],
  optional: [
    // Лента изменений: страницы приложения обновляются сами.
    CHAIN_CHANGES_PORT,
  ],
};
