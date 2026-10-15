#include "loan.hpp"
#include <ctime>
#include <eosio/transaction.hpp>

#include "src/createdebt.cpp"
#include "src/settledebt.cpp"

using namespace eosio;

/**
 * @brief Миграция данных контракта.
 * @ingroup public_actions
 * @ingroup public_loan_actions

 * @note Авторизация требуется от аккаунта: @p loan
 */
[[eosio::action]]
void loan::migrate(){
  require_auth(_loan);
};

/**
 * @brief Очистка отработавших записей (lib/core/cleanup.hpp).
 *
 * Правил нет: долг и сводка удаляются при полном погашении, в таблицах только открытые обязательства.
 *
 * @note Авторизация требуется от аккаунта контракта.
 */
void loan::cleanup() {
  require_auth(get_self());
  Cleanup::budget budget;
  Cleanup::report(get_self(), budget);
}
