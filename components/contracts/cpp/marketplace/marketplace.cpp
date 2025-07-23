#include "marketplace.hpp"
#include <eosio/transaction.hpp>


// Процесс поставки OFFER → ORDER (deliver_on_offer)
#include "src/deliver_on_offer/parentoffer.cpp"
#include "src/deliver_on_offer/childorder.cpp"
#include "src/deliver_on_offer/acceptoff.cpp"
#include "src/deliver_on_offer/authoff.cpp"
#include "src/deliver_on_offer/declineacc.cpp"
#include "src/deliver_on_offer/supplyoff.cpp"
#include "src/deliver_on_offer/supplcnfoff.cpp"
#include "src/deliver_on_offer/deliveroff.cpp"
#include "src/deliver_on_offer/recvoff.cpp"
#include "src/deliver_on_offer/recvcnfoff.cpp"
#include "src/deliver_on_offer/completeoff.cpp"
#include "src/deliver_on_offer/declineoff.cpp"

// Процесс поставки ORDER → OFFER (deliver_on_order)
#include "src/deliver_on_order/parentorder.cpp"
#include "src/deliver_on_order/childoffer.cpp"
#include "src/deliver_on_order/acceptord.cpp"
#include "src/deliver_on_order/authord.cpp"
#include "src/deliver_on_order/supplyord.cpp"
#include "src/deliver_on_order/supplcnford.cpp"
#include "src/deliver_on_order/deliverord.cpp"
#include "src/deliver_on_order/recvord.cpp"
#include "src/deliver_on_order/recvcnford.cpp"
#include "src/deliver_on_order/completeord.cpp"
#include "src/deliver_on_order/declineord.cpp"

// Управление заявками
#include "src/management/cancel.cpp"

// Диспуты
#include "src/dispute/dispute.cpp"
#include "src/dispute/wauthorize.cpp"
#include "src/dispute/wreturn.cpp"
#include "src/dispute/woffer.cpp"
#include "src/dispute/waccept.cpp"


[[eosio::action]] void marketplace::migrate(){
  require_auth(_marketplace);
}