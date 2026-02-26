#include "marketplace.hpp"
#include <eosio/transaction.hpp>

// Процесс поставки по заявкам orderoffer
#include "src/deliver_on_offer/orderoffer.cpp"
#include "src/deliver_on_offer/accept.cpp"
#include "src/deliver_on_offer/authcontrib.cpp"
#include "src/deliver_on_offer/authreturn.cpp"
#include "src/deliver_on_offer/declineacc.cpp"
#include "src/deliver_on_offer/supply.cpp"
#include "src/deliver_on_offer/supplcnf.cpp"

#include "src/deliver_on_offer/coopstock.cpp"
#include "src/deliver_on_offer/acceptstock.cpp"
#include "src/deliver_on_offer/requestreturn.cpp"
#include "src/deliver_on_offer/delivered.cpp"
#include "src/deliver_on_offer/receive.cpp"
#include "src/deliver_on_offer/receivecnf.cpp"
#include "src/deliver_on_offer/complete.cpp"
#include "src/deliver_on_offer/decline.cpp"
#include "src/deliver_on_offer/cancel.cpp"

// Новая система перевозок
#include "src/shipment/createship.cpp"
#include "src/shipment/signbydriver.cpp"
#include "src/shipment/arrived.cpp"
#include "src/shipment/receiveshipm.cpp"
#include "src/shipment/retransport.cpp"

// Диспуты
#include "src/dispute_on_offer/dispute.cpp"
#include "src/dispute_on_offer/wauthorize.cpp"
#include "src/dispute_on_offer/wreturn.cpp"
#include "src/dispute_on_offer/woffer.cpp"
#include "src/dispute_on_offer/waccept.cpp"


[[eosio::action]] void marketplace::migrate(){
  // require_auth(_marketplace);
}
