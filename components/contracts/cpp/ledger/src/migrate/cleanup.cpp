/**
 * @brief Очистка отработавших записей прежнего учёта (lib/core/cleanup.hpp).
 *
 * Правило: оплаченное списание. После оплаты его не читает ни одно действие,
 * кроме проверки повтора при заведении, а заведение требует решения совета.
 * Счета не трогаем — это учёт, пустой счёт удаляет сам `sub`.
 *
 * @note Авторизация требуется от аккаунта: @p ledger
 */
void ledger::cleanup() {
  require_auth(_ledger);
  Cleanup::budget budget;

  writeoffs_index writeoffs(_ledger, _ledger.value);
  Cleanup::erase_where(writeoffs, budget, [&](const auto &writeoff) {
    return writeoff.status == "paid"_n;
  });

  Cleanup::report(_ledger, budget);
}
