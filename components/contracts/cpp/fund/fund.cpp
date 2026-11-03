#include "fund.hpp"

#include <ctime>
#include <eosio/transaction.hpp>

#include "src/accrue.cpp"
#include "src/deprecated.cpp"
#include "src/editfund.cpp"
#include "src/init.cpp"

using namespace eosio;

/**
 * @brief Доводит действующие кооперативы до пяти стандартных фондов в `funds`
 * (задача 99D-25).
 *
 * У кооперативов, заведённых до переноса фондов на кошельки, таблицы `funds`
 * нет — её заполняет этот прогон с процентами по умолчанию 1 / 15 / 5: на проде
 * проценты именно такие, поэтому прежние строки `accfunds` не читаются. Строки,
 * которые уже есть, не трогаются — председатель мог изменить процент.
 * Идемпотентно: повторный прогон ничего не пишет.
 *
 * @ingroup public_actions
 * @ingroup public_fund_actions
 * @note Авторизация требуется от аккаунта: @p _fund
 */
[[eosio::action]] void fund::migrate() {
  require_auth(_fund);
  for (const auto &coopname : Core::Registrator::get_cooperative_names()) {
    Fund::ensure_standard_funds(coopname);
  }
}

/**
 * @brief Очистка отработавших записей фондов (lib/core/cleanup.hpp).
 *
 * Правило: таблицы прежнего учёта остатков — `coopwallet`, `accfunds`,
 * `expfunds`, `fwithdraws` — код больше не читает: остатки фондов ведёт ledger2
 * на кошельках фондов (задача 99D-25). Суммы в этих строках уже учтены в
 * ledger2 и в прежнем виде только путают учёт, поэтому стираются целиком.
 *
 * @note Авторизация требуется от аккаунта: @p fund
 */
void fund::cleanup() {
  require_auth(_fund);
  Cleanup::budget budget;

  for (const auto &coopname : Core::Registrator::get_cooperative_names()) {
    if (budget.exhausted()) break;

    coopwallet_index coopwallet(_fund, coopname.value);
    Cleanup::erase_all(coopwallet, budget);

    accfunds_index accfunds(_fund, coopname.value);
    Cleanup::erase_all(accfunds, budget);

    expfunds_index expfunds(_fund, coopname.value);
    Cleanup::erase_all(expfunds, budget);

    fundwithdraws_index withdraws(_fund, coopname.value);
    Cleanup::erase_all(withdraws, budget);
  }

  Cleanup::report(_fund, budget);
}
