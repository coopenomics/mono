#include "billing.hpp"
#include <ctime>
#include <eosio/transaction.hpp>

#include "src/convert.cpp"
#include "src/pay.cpp"
#include "src/converttoaxn.cpp"

using namespace eosio;

/**
 * @brief Миграция данных контракта.
 * @ingroup public_billing_actions
 * @note Авторизация требуется от аккаунта: @p billing
 */
[[eosio::action]]
void billing::migrate() {
  require_auth(_billing);
}
