#include "marketplace.hpp"
#include <eosio/transaction.hpp>

// Процесс поставки
#include "src/deliver/accept.cpp"
#include "src/deliver/authorize.cpp"
#include "src/deliver/supply.cpp"
#include "src/deliver/supplycnfrm.cpp"
#include "src/deliver/delivered.cpp"
#include "src/deliver/recieve.cpp"
#include "src/deliver/recievecnfrm.cpp"
#include "src/deliver/complete.cpp"
#include "src/deliver/decline.cpp"

// Управление заявками
#include "src/management/change.cpp"
#include "src/management/offer.cpp"
#include "src/management/order.cpp"
#include "src/management/addunits.cpp"
#include "src/management/update.cpp"
#include "src/management/cancel.cpp"
#include "src/management/publish.cpp"
#include "src/management/unpublish.cpp"

// Модерация
#include "src/moderation/moderate.cpp"
#include "src/moderation/prohibit.cpp"

// Диспуты
#include "src/dispute/dispute.cpp"
#include "src/dispute/wauthorize.cpp"
#include "src/dispute/wreturn.cpp"
#include "src/dispute/woffer.cpp"
#include "src/dispute/waccept.cpp"

/**
 * @brief Пустой метод регистрации нового идентификатора
 * @ingroup public_actions
 * Этот метод используется для возврата информации из контракта.
 * @param id идентификатор
 * @param type тип идентификатора
 */
[[eosio::action]] void marketplace::newid(uint64_t id, eosio::name type) {
  require_auth(_marketplace);
};


[[eosio::action]] void marketplace::migrate(){
  require_auth(_marketplace);
}