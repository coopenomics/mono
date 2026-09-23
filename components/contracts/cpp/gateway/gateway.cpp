#include "gateway.hpp"
#include <ctime>
#include <eosio/transaction.hpp>

#include "src/inpay/createinpay.cpp"
#include "src/inpay/incomplete.cpp"
#include "src/inpay/indecline.cpp"

#include "src/outpay/createoutpay.cpp"
#include "src/outpay/outcomplete.cpp"
#include "src/outpay/outdecline.cpp"

using namespace eosio;

/**
 * @brief Миграция контракта процессинга платежей.
 * Выполняет миграцию контракта на новую версию.
 * @ingroup public_actions
 * @ingroup public_gateway_actions

 * @note Авторизация требуется от аккаунта: @p _gateway
 */
[[eosio::action]]
void gateway::migrate(){
  require_auth(_gateway);
};

/**
 * @brief Очистка отработавших записей (lib/core/cleanup.hpp).
 *
 * Правил нет: входящие и исходящие платежи удаляются при подтверждении или отклонении. Зависший платёж закрывается отклонением с колбэками кошелька и регистратора, это не очистка.
 *
 * @note Авторизация требуется от аккаунта контракта.
 */
void gateway::cleanup() {
  require_auth(get_self());
  Cleanup::budget budget;
  Cleanup::report(get_self(), budget);
}
