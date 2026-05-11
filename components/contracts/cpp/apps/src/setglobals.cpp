/**
 * \brief Установка общесистемных параметров каталога (singleton-перезапись).
 * \ingroup public_apps_actions
 *
 * Story v2.1.1: каркас без валидации диапазонов. Что делает действие:
 *  1. Требует `apps@active` — `require_auth(get_self())`.
 *  2. Полная перезапись `globals` singleton (scope = `get_self()`,
 *     PK у singleton нет): четыре поля заполняются переданными значениями.
 *
 * Что **не делает** (выносится в Story v2.1.2):
 *  - Проверка диапазонов: `min_payment_period_seconds >= 60`,
 *    `free_trial_period_seconds <= 31 * 86400`, `retry_max <= 8` и т.п.
 *  - Snapshot предыдущего state'а в audit_log_admin — off-chain
 *    (journal-less invariant).
 *
 * RAM payer — `get_self()`. ВОСХОД как owner аккаунта `apps` оплачивает
 * хранение singleton'а (одна запись, минимальный RAM).
 */
void apps::setglobals(uint32_t min_payment_period_seconds,
                      uint32_t free_trial_period_seconds,
                      uint32_t lead_time_seconds,
                      uint8_t  retry_max) {
  require_auth(get_self());

  globals_singleton globals(get_self(), get_self().value);
  globals.set(globals_row{
                  .min_payment_period_seconds = min_payment_period_seconds,
                  .free_trial_period_seconds  = free_trial_period_seconds,
                  .lead_time_seconds          = lead_time_seconds,
                  .retry_max                  = retry_max,
              },
              get_self());
}
