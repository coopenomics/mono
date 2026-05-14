#include "marketplace.hpp"

// p.mkt.supply (10 actions) — Stories Эпиков 4-5-6.
#include "src/createorder.cpp"
#include "src/cancelorder.cpp"
#include "src/expirecycle.cpp"
#include "src/acceptbatch.cpp"
#include "src/declinebatch.cpp"
#include "src/prepship.cpp"
#include "src/signsupp.cpp"
#include "src/signchair.cpp"
#include "src/signiss1.cpp"
#include "src/signiss2.cpp"

// p.mkt.return (5 actions) — Stories Эпика 7.
#include "src/submretrn.cpp"
#include "src/aprretrem.cpp"
#include "src/rejretrem.cpp"
#include "src/accretrn.cpp"
#include "src/rejretrn.cpp"

// p.mkt.wroff (3 actions) — Stories Эпика 8.
#include "src/propwroff.cpp"
#include "src/execwroff.cpp"
#include "src/declwroff.cpp"

[[eosio::action]] void marketplace::migrate() {
  // Donor-таблиц нет (AR30 — donor-actions удалены вместе с requests/segments/
  // shipments). Заглушка остаётся для совместимости с прежним ABI; вызывать
  // не имеет эффекта.
  require_auth(_marketplace);
}
