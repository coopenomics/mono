/**
 * @brief Очистка отработавших записей регистратора (lib/core/cleanup.hpp).
 *
 * Правило: строка прежней таблицы кооперативов `orgs`, чей кооператив есть в
 * нынешнем реестре `coops`. Данные перенесены туда с теми же документами и
 * подписями (сверено по сети 23.09.2026), прежнюю таблицу код не читает.
 *
 * @note Авторизация требуется от аккаунта: @p registrator
 */
void registrator::cleanup() {
  require_auth(_registrator);
  Cleanup::budget budget;

  cooperatives2_index coops(_registrator, _registrator.value);
  cooperatives_index legacy(_registrator, _registrator.value);
  Cleanup::erase_where(legacy, budget, [&](const auto &org) {
    return coops.find(org.username.value) != coops.end();
  });

  Cleanup::report(_registrator, budget);
}
