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

/**
 * @brief Очистка отработавших записей (lib/core/cleanup.hpp).
 *
 * Правил нет: контракт своих таблиц не ведёт — дедуп платежей живёт в журнале
 * оператора, деньги — в ledger2 и кошельках. Действие есть, потому что плейбук
 * раскатки и boot-тест contracts-cleanup вызывают cleanup у каждого прикладного
 * контракта.
 *
 * @ingroup public_billing_actions
 * @note Авторизация требуется от аккаунта: @p billing
 */
[[eosio::action]]
void billing::cleanup() {
  require_auth(get_self());
  Cleanup::budget budget;
  Cleanup::report(get_self(), budget);
}
