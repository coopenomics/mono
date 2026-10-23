/**
 * @brief Очистка отработавших записей учёта (lib/core/cleanup.hpp).
 *
 * Правило: служебная строка `meta` разовой миграции остатков из прежнего
 * учёта. Миграция отработала 14.05.2026, строку код больше не читает и не
 * пишет. Счета и кошельки не трогаем — это учёт.
 *
 * @note Авторизация требуется от аккаунта: @p ledger2
 */
void ledger2::cleanup() {
  require_auth(get_self());
  Cleanup::budget budget;

  ledger2_meta_index meta(get_self(), get_self().value);
  Cleanup::erase_all(meta, budget);

  Cleanup::report(get_self(), budget);
}
