#include "fund.hpp"

#include <ctime>
#include <eosio/transaction.hpp>

#include "src/addaccum.cpp"
#include "src/addcirculate.cpp"
#include "src/addexpense.cpp"
#include "src/accumfee.cpp"
#include "src/addinitial.cpp"
#include "src/authorize.cpp"
#include "src/delfund.cpp"
#include "src/complete.cpp"
#include "src/createfund.cpp"
#include "src/editfund.cpp"
#include "src/fundwithdraw.cpp"
#include "src/init.cpp"
#include "src/spreadamount.cpp"
#include "src/subaccum.cpp"
#include "src/subcirculate.cpp"
#include "src/subinitial.cpp"


using namespace eosio;

[[eosio::action]] void fund::migrate() {
  require_auth(_fund);
}

/**
 * @brief Пустой метод регистрации нового идентификатора
 * @ingroup public_actions
 * Этот метод используется для возврата информации из контракта.
 * @param id идентификатор
 * @param type тип идентификатора
 */
[[eosio::action]] void fund::newfund(eosio::name coopname, eosio::name type,
                                     uint64_t id) {
  require_auth(_fund);
};

/**
 * @brief Пустой метод регистрации нового идентификатора
 * @ingroup public_actions
 * Этот метод используется для возврата информации из контракта.
 * @param id идентификатор
 * @param type тип идентификатора
 */
[[eosio::action]] void fund::newwithdraw(eosio::name coopname, eosio::name type,
                                         uint64_t id) {
  require_auth(_fund);
};
