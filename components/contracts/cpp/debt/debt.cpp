#include "debt.hpp"
#include <eosio/transaction.hpp>

#include "src/createloan.cpp"
#include "src/loanauth.cpp"
#include "src/loandecl.cpp"
#include "src/loansigned.cpp"
#include "src/loansgndecl.cpp"
#include "src/loanpaid.cpp"
#include "src/loanpaydecl.cpp"
#include "src/retrypay.cpp"
#include "src/cancelloan.cpp"
#include "src/repayloan.cpp"
#include "src/extendloan.cpp"
#include "src/loanextok.cpp"
#include "src/loanextdecl.cpp"
#include "src/sweep.cpp"
#include "src/regloan.cpp"
#include "src/settleloan.cpp"
#include "src/wroffloan.cpp"

using namespace eosio;

/**
 * @brief Миграция данных контракта.
 * @ingroup public_actions
 * @ingroup public_debt_actions

 * @note Авторизация требуется от аккаунта: @p debt
 */
[[eosio::action]]
void debt::migrate(){
  require_auth(_debt);
};

/**
 * @brief Очистка отработавших записей (lib/core/cleanup.hpp).
 *
 * Правило одно: сводка долга пайщика с нулевым остатком. Запись о займе
 * удаляется на терминальном шаге сама, в таблице живут только открытые займы.
 *
 * @note Авторизация требуется от аккаунта контракта.
 */
void debt::cleanup() {
  require_auth(get_self());
  Cleanup::budget budget;

  for (const auto &coopname : Core::Registrator::get_cooperative_names()) {
    if (budget.exhausted()) break;
    Debt::summaries_index summaries(_debt, coopname.value);
    Cleanup::erase_where(summaries, budget, [&](const auto &s) { return s.total.amount == 0; });
  }

  Cleanup::report(get_self(), budget);
}
