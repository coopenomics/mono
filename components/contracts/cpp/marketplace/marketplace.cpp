#include "marketplace.hpp"

// Раскладка по процессам соответствует YAML-стандартам рядом с этим файлом
// (p.mkt.supply.standard.yaml / p.mkt.return.standard.yaml /
// p.mkt.wroff.standard.yaml). Имена подпапок 1:1 совпадают с process_type
// — связь от файла → к стандарту прозрачная.

// ── p.mkt.supply (11 actions) ─── Stories Эпиков 4-5-6 ─────────────────
#include "src/p.mkt.supply/convert.cpp"
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
#include "src/p.mkt.supply/readyissue.cpp"
#include "src/p.mkt.supply/issuestmt.cpp"
#include "src/p.mkt.supply/onmktisauth.cpp"
#include "src/p.mkt.supply/onmktisdecl.cpp"
#include "src/p.mkt.supply/issueact1.cpp"
#include "src/p.mkt.supply/issueact2.cpp"
#include "src/p.mkt.supply/cancelissue.cpp"

// ── p.mkt.return (5 actions) ──── Stories Эпика 7 ──────────────────────
#include "src/p.mkt.return/submretrn.cpp"
#include "src/p.mkt.return/aprretrem.cpp"
#include "src/p.mkt.return/rejretrem.cpp"
#include "src/p.mkt.return/accretrn.cpp"
#include "src/p.mkt.return/rejretrn.cpp"
#include "src/p.mkt.return/return_fee_helpers.hpp"
#include "src/p.mkt.return/onmktrtauth.cpp"
#include "src/p.mkt.return/payretfee.cpp"
#include "src/p.mkt.return/onmktrtdecl.cpp"

// ── p.mkt.claim (1 action) ── гарантийная претензия поставщику (99D-13) ──
#include "src/p.mkt.claim/admitclaim.cpp"
#include "src/p.mkt.return/handback.cpp"

// ── p.mkt.wroff (4 actions) ───── Stories Эпика 8 ──────────────────────
// Канонический паттерн «решение совета»: propwroff (admin) → soviet::createagenda
// → onmktwoauth / onmktwodecl (callback от soviet после голосования) → execwroff
// per-item (backend цикл).
#include "src/p.mkt.wroff/propwroff.cpp"
#include "src/p.mkt.wroff/onmktwoauth.cpp"
#include "src/p.mkt.wroff/onmktwodecl.cpp"
#include "src/p.mkt.wroff/execwroff.cpp"
#include "src/p.mkt.wroff/confirmwroff.cpp"

/**
 * Перенос открытых обязательств перед поставщиками на кошелёк к оплате
 * `w.mkt.topay` (задача 99D-16, решение владельца 10.09.2026).
 *
 * До появления кошелька приёмка проводила только Дт 10 / Кт 76, и у заказов,
 * принятых раньше, суммы к оплате на кошельке нет — выплата по ним списывает
 * с него и упала бы на нехватке. Здесь по каждому поставщику считается
 * непогашенное: принятая стоимость заказов, выплата по которым не завершена,
 * за вычетом уже удержанного при инициации долга. Начисляется только разница
 * с текущим остатком кошелька: приёмка после установки уже пополнила его сама,
 * а повторный запуск ничего не удваивает. Проводки нет — Кт 76 проведён
 * приёмкой. Как и `migrate` остальных контрактов, вызывается без аргументов
 * при установке и обходит все кооперативы.
 */
static void migrate_supplier_payables(eosio::name coopname);

[[eosio::action]] void marketplace::migrate() {
  require_auth(_marketplace);

  cooperatives2_index coops(_registrator, _registrator.value);
  for (auto c = coops.begin(); c != coops.end(); ++c) {
    migrate_supplier_payables(c->username);
  }
}

static void migrate_supplier_payables(eosio::name coopname) {
  std::vector<std::pair<eosio::name, eosio::asset>> outstanding_by_supplier;
  Marketplace::orders_index orders(_marketplace, coopname.value);
  for (const auto& o : orders) {
    if (o.offerer == coopname) continue;
    const bool accepted_by_coop =
        o.status == OrderStatus::ACCEPTED_TO_COOP || o.status == OrderStatus::READY_TO_RECEIVE ||
        o.status == OrderStatus::ISSUE_PENDING    || o.status == OrderStatus::ISSUE_AUTHORIZED ||
        o.status == OrderStatus::ISSUE_ACT1       || o.status == OrderStatus::RECEIVED ||
        o.status == OrderStatus::REFUSED;
    if (!accepted_by_coop || o.payout_status == OrderPayoutStatus::COMPLETED) continue;

    const eosio::asset withheld = o.payout_withheld.has_value()
        ? o.payout_withheld.value()
        : eosio::asset(0, _root_govern_symbol);
    const eosio::asset outstanding = Marketplace::get_accepted_cost(o) - withheld;
    if (outstanding.amount <= 0) continue;

    bool merged = false;
    for (auto& entry : outstanding_by_supplier) {
      if (entry.first == o.offerer) { entry.second += outstanding; merged = true; break; }
    }
    if (!merged) outstanding_by_supplier.emplace_back(o.offerer, outstanding);
  }

  for (const auto& [supplier, outstanding] : outstanding_by_supplier) {
    const auto payable = Marketplace::get_user_wallet_balance(
        coopname, ledger2_wallets::MARKETPLACE_SUPPLIER_PAYABLE, supplier);
    const eosio::asset deficit = outstanding - payable.available;
    if (deficit.amount <= 0) continue;

    const std::string seed = "marketplace.topay:" + coopname.to_string() + ":" + supplier.to_string();
    Ledger2::apply(_marketplace, coopname,
                   operations::migration::SUPPLIER_PAYABLE,
                   processes::migration::TRANSIT,
                   deficit, supplier, eosio::sha256(seed.data(), seed.size()),
                   "Перенос открытых обязательств перед поставщиком на кошелёк к оплате, поставщик=" + supplier.to_string());
  }
}
