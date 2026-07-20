#include "marketplace.hpp"

// Раскладка по процессам соответствует YAML-стандартам рядом с этим файлом
// (p.mkt.supply.standard.yaml / p.mkt.return.standard.yaml /
// p.mkt.wroff.standard.yaml). Имена подпапок 1:1 совпадают с process_type
// — связь от файла → к стандарту прозрачная.

// ── p.mkt.supply (11 actions) ─── Stories Эпиков 4-5-6 ─────────────────
#include "src/p.mkt.supply/createorder.cpp"
#include "src/p.mkt.supply/stockorder.cpp"
#include "src/p.mkt.supply/markdown.cpp"
#include "src/p.mkt.supply/setfee.cpp"
#include "src/p.mkt.supply/cancelorder.cpp"
#include "src/p.mkt.supply/expireorder.cpp"
#include "src/p.mkt.supply/closeorder.cpp"
#include "src/p.mkt.supply/acceptorder.cpp"
#include "src/p.mkt.supply/declineorder.cpp"
#include "src/p.mkt.supply/signsupp.cpp"
#include "src/p.mkt.supply/signchair.cpp"
#include "src/p.mkt.supply/payout.cpp"
#include "src/p.mkt.supply/payconfirm.cpp"
#include "src/p.mkt.supply/paydecline.cpp"
#include "src/p.mkt.supply/signiss1.cpp"
#include "src/p.mkt.supply/signiss2.cpp"

// ── p.mkt.return (5 actions) ──── Stories Эпика 7 ──────────────────────
#include "src/p.mkt.return/submretrn.cpp"
#include "src/p.mkt.return/aprretrem.cpp"
#include "src/p.mkt.return/rejretrem.cpp"
#include "src/p.mkt.return/accretrn.cpp"
#include "src/p.mkt.return/rejretrn.cpp"

// ── p.mkt.wroff (4 actions) ───── Stories Эпика 8 ──────────────────────
// Канонический паттерн «решение совета»: propwroff (admin) → soviet::createagenda
// → onmktwoauth / onmktwodecl (callback от soviet после голосования) → execwroff
// per-item (backend цикл).
#include "src/p.mkt.wroff/propwroff.cpp"
#include "src/p.mkt.wroff/onmktwoauth.cpp"
#include "src/p.mkt.wroff/onmktwodecl.cpp"
#include "src/p.mkt.wroff/execwroff.cpp"

[[eosio::action]] void marketplace::migrate() {
  // Donor-таблиц нет (AR30 — donor-actions удалены вместе с requests/segments/
  // shipments). Заглушка остаётся для совместимости с прежним ABI; вызывать
  // не имеет эффекта.
  require_auth(_marketplace);
}
