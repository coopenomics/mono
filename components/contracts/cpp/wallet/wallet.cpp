#include "wallet.hpp"
#include <ctime>
#include <eosio/transaction.hpp>

#include "src/deposit/completedpst.cpp"
#include "src/deposit/createdpst.cpp"
#include "src/deposit/declinedpst.cpp"

#include "src/withdraw/authwthd.cpp"
#include "src/withdraw/completewthd.cpp"
#include "src/withdraw/createwthd.cpp"
#include "src/withdraw/declinewthd.cpp"

#include "src/agreement/signagree.cpp"
#include "src/agreement/revokeagree.cpp"
#include "src/agreement/migrate3.cpp"
#include "src/agreement/importagree.cpp"

using namespace eosio;

[[eosio::action]]
void wallet::migrate(){
  require_auth(_wallet);
};

/**
 * @brief Очистка отработавших записей (lib/core/cleanup.hpp).
 *
 * Правил нет: депозиты и выводы удаляются на терминальном шаге, соглашения пайщиков по программам — юридические записи.
 *
 * @note Авторизация требуется от аккаунта контракта.
 */
void wallet::cleanup() {
  require_auth(get_self());
  Cleanup::budget budget;
  Cleanup::report(get_self(), budget);
}
