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
#include "src/p.mkt.supply/chargedue.cpp"
#include "src/p.mkt.supply/setshares.cpp"
#include "src/p.mkt.supply/setinitiator.cpp"
#include "src/p.mkt.supply/closeperiod.cpp"
#include "src/p.mkt.supply/delperiod.cpp"
#include "src/p.mkt.supply/chargeperiod.cpp"
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

// ── p.mkt.invest ─── инвестиционный этап участка (задача 99D-27) ─────────
#include "src/p.mkt.invest/iprop_helpers.hpp"
#include "src/p.mkt.invest/signinvagr.cpp"
#include "src/p.mkt.invest/investmoney.cpp"
#include "src/p.mkt.invest/createiprop.cpp"
#include "src/p.mkt.invest/approveiprop.cpp"
#include "src/p.mkt.invest/declineiprop.cpp"
#include "src/p.mkt.invest/onipropauth.cpp"
#include "src/p.mkt.invest/onipropdecl.cpp"
#include "src/p.mkt.invest/act1iprop.cpp"
#include "src/p.mkt.invest/act2iprop.cpp"
#include "src/p.mkt.invest/fundipool.cpp"
#include "src/p.mkt.invest/unfundipool.cpp"
#include "src/p.mkt.invest/spentipool.cpp"
#include "src/p.mkt.invest/claiminv.cpp"
#include "src/p.mkt.invest/exitinv.cpp"

// ── p.mkt.return (5 actions) ──── Stories Эпика 7 ──────────────────────
#include "src/p.mkt.return/submretrn.cpp"
#include "src/p.mkt.return/aprretrem.cpp"
#include "src/p.mkt.return/rejretrem.cpp"
#include "src/p.mkt.return/accretrn.cpp"
#include "src/p.mkt.return/rejretrn.cpp"
#include "src/p.mkt.return/onmktrtauth.cpp"
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

/**
 * Перенос обеспечительной части невыданных заказов из общего пула `w.mkt.fee`
 * на кошелёк пайщика под заказы `w.mkt.secure` (решение владельца 05.11.2026:
 * средства заказа видны пайщику на всём пути).
 *
 * До правки заказ клал обеспечительную часть в общий пул кооператива, и до
 * выдачи пайщик не видел её ни на одном своём кошельке. Новые заказы кладут её
 * на кошелёк пайщика, а возврат и переход к списанию берут её с этого кошелька — у
 * заказов, оформленных раньше, сумма обязана переехать, иначе их отмена и
 * выдача упадут на нехватке.
 *
 * По каждому пайщику считается обеспечительная часть его невыданных заказов
 * (поле `membership_fee` заказа — ровно то, что лежит под ним), из неё
 * вычитается остаток кошелька: новые заказы уже положили своё, а повторный
 * запуск ничего не удваивает. Переносится не больше остатка пула: установка на
 * узле со странной историей не должна падать.
 */
static void migrate_secure_parts(eosio::name coopname);

[[eosio::action]] void marketplace::migrate() {
  require_auth(_marketplace);

  for (const auto& coopname : Core::Registrator::get_cooperative_names()) {
    migrate_supplier_payables(coopname);
    migrate_secure_parts(coopname);
  }
}

static bool order_awaits_issue(const Marketplace::order& o) {
  return o.status == OrderStatus::ACTIVE           || o.status == OrderStatus::ACCEPTED         ||
         o.status == OrderStatus::SUPPLY_PREPARED  || o.status == OrderStatus::ACCEPTED_TO_COOP ||
         o.status == OrderStatus::READY_TO_RECEIVE || o.status == OrderStatus::ISSUE_PENDING    ||
         o.status == OrderStatus::ISSUE_AUTHORIZED || o.status == OrderStatus::ISSUE_ACT1;
}

static void migrate_secure_parts(eosio::name coopname) {
  wallets2_index pools(_ledger2, coopname.value);
  auto pool = pools.find(ledger2_wallets::MARKETPLACE_FEE_POOL.value);
  if (pool == pools.end() || pool->available.amount <= 0) return;
  eosio::asset pool_left = pool->available;

  std::vector<std::pair<eosio::name, eosio::asset>> secured_by_member;
  Marketplace::orders_index orders(_marketplace, coopname.value);
  for (const auto& o : orders) {
    if (!order_awaits_issue(o)) continue;
    const eosio::asset fee = Marketplace::get_order_membership_fee(o);
    if (fee.amount <= 0) continue;

    bool merged = false;
    for (auto& entry : secured_by_member) {
      if (entry.first == o.orderer) { entry.second += fee; merged = true; break; }
    }
    if (!merged) secured_by_member.emplace_back(o.orderer, fee);
  }

  for (const auto& [member, secured] : secured_by_member) {
    if (pool_left.amount <= 0) break;
    const auto wallet = Marketplace::get_user_wallet_balance(
        coopname, ledger2_wallets::MARKETPLACE_SECURE_ORDER, member);
    eosio::asset deficit = secured - wallet.available;
    if (deficit.amount <= 0) continue;
    if (deficit > pool_left) deficit = pool_left;
    pool_left -= deficit;

    const std::string seed = "marketplace.secure:" + coopname.to_string() + ":" + member.to_string();
    Ledger2::apply(_marketplace, coopname,
                   operations::migration::SECURE_ORDER,
                   processes::migration::TRANSIT,
                   deficit, member, eosio::sha256(seed.data(), seed.size()),
                   "Перенос обеспечительной части невыданных заказов на кошелёк пайщика, пайщик=" + member.to_string());
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

    const eosio::asset withheld = Marketplace::get_payout_withheld(o);
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

/**
 * @brief Очистка отработавших записей Стола заказов (lib/core/cleanup.hpp).
 *
 * Правило: признанная поставщиком претензия. Долг поставщика после признания
 * живёт в кошельке долга и удерживается из выплат, строку претензии читает
 * только проверка повтора при её заведении из возврата, а возврат к этому
 * моменту закрыт.
 *
 * @note Авторизация требуется от аккаунта: @p marketplace
 */
void marketplace::cleanup() {
  require_auth(_marketplace);
  Cleanup::budget budget;

  for (const auto &coopname : Core::Registrator::get_cooperative_names()) {
    if (budget.exhausted()) break;

    Marketplace::warranty_claims_index claims(_marketplace, coopname.value);
    Cleanup::erase_where(claims, budget, [&](const auto &claim) {
      return claim.status == Marketplace::ClaimStatus::ADMITTED;
    });
  }

  Cleanup::report(_marketplace, budget);
}
