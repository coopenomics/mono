#include "marketplace.hpp"
#include <eosio/transaction.hpp>


// Процесс поставки OFFER → ORDER (deliver_on_offer)
#include "src/deliver_on_offer/parentoffer.cpp"
#include "src/deliver_on_offer/childorder.cpp"
#include "src/deliver_on_offer/acceptoff.cpp"
#include "src/deliver_on_offer/authoffs2c.cpp"
#include "src/deliver_on_offer/authoffc2r.cpp"
#include "src/deliver_on_offer/declineacc.cpp"
#include "src/deliver_on_offer/supplyoff.cpp"
#include "src/deliver_on_offer/supplcnfoff.cpp"
#include "src/deliver_on_offer/deliveroff1.cpp"
#include "src/deliver_on_offer/deliveroff2.cpp"
#include "src/deliver_on_offer/deliveroff3.cpp"
#include "src/deliver_on_offer/deliveroff4.cpp"
#include "src/deliver_on_offer/recvoff.cpp"
#include "src/deliver_on_offer/recvcnfoff.cpp"
#include "src/deliver_on_offer/completeoff.cpp"
#include "src/deliver_on_offer/declineoff.cpp"
#include "src/deliver_on_offer/cancel.cpp"
// Процесс поставки ORDER → OFFER (deliver_on_order)
// #include "src/deliver_on_order/parentorder.cpp"
// #include "src/deliver_on_order/childoffer.cpp"
// #include "src/deliver_on_order/acceptord.cpp"
// #include "src/deliver_on_order/authords2c.cpp"
// #include "src/deliver_on_order/authordc2r.cpp"
// #include "src/deliver_on_order/supplyord.cpp"
// #include "src/deliver_on_order/supplcnford.cpp"
// #include "src/deliver_on_order/deliverord.cpp"
// #include "src/deliver_on_order/recvord.cpp"
// #include "src/deliver_on_order/recvcnford.cpp"
// #include "src/deliver_on_order/completeord.cpp"
// #include "src/deliver_on_order/declineord.cpp"


// Диспуты
#include "src/dispute_on_offer/dispute.cpp"
#include "src/dispute_on_offer/wauthorize.cpp"
#include "src/dispute_on_offer/wreturn.cpp"
#include "src/dispute_on_offer/woffer.cpp"
#include "src/dispute_on_offer/waccept.cpp"


[[eosio::action]] void marketplace::migrate(){
  require_auth(_marketplace);
}