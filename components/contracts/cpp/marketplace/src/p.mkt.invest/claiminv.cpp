/**
 * @brief Инициатор транслирует возвращённый паевой взнос в главный паевой
 * кошелёк по заявлению 1123 (задача 99D-27).
 *
 * Сумму считает контракт, ИСТОК её не передаёт:
 *  - возвращённое из экономии участка по счётчику возврата минус уже
 *    забранное (имущество и израсходованные деньги, пропорционально);
 *  - неиспользованные деньги — когда использованное инициатора возвращено
 *    целиком либо участку больше нечего возвращать (подушка на дефицитные
 *    месяцы держится до этого момента, решение владельца 07.11.2026);
 *  - прежние начисления доли инициатора (o.mkt.initr до 99D-27), которые
 *    лежат на том же кошельке вне строк паевых взносов.
 * Всё доступное забирается одним заявлением: перевод `w.mkt.invest →
 * w.wal.share` без проводки (o.mkt.iback). Паевой взнос инициатора остаётся
 * на счёте 80; деньгами он получает его обычным возвратом паевого взноса.
 * Строка инициатора стирается, когда забрано всё.
 *
 * Guards: авторизация кооператива; заявление подписано инициатором; строка
 * инициатора по участку есть; к трансляции есть сумма больше нуля.
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::claiminv(eosio::name coopname, eosio::name username, eosio::name braname,
                           checksum256 claim_hash, document2 statement) {
  require_auth(coopname);
  eosio::check(claim_hash != checksum256{},
               "MARKETPLACE_INVEST_HASH_MISSING: Не указан идентификатор заявления");
  eosio::check(!is_empty_document(statement),
               "MARKETPLACE_INVEST_STATEMENT_MISSING: Отсутствует заявление о трансляции средств в главный паевой");
  verify_document_or_fail(statement, { username });
  verify_signer_keys_or_fail(statement, username);

  mkt_invbranches_index branches(_marketplace, coopname.value);
  auto bit = branches.find(braname.value);
  mkt_investors_index investors(_marketplace, coopname.value);
  auto by_pair = investors.get_index<"bybruser"_n>();
  auto it = by_pair.find(combine_ids(braname.value, username.value));
  eosio::check(bit != branches.end() && it != by_pair.end(),
               "MARKETPLACE_INVEST_NOT_FOUND: Паевых взносов пайщика в этот участок нет");

  // Прежние начисления: остаток кошелька сверх того, что числится в строках.
  int64_t in_rows = 0;
  {
    auto by_user = investors.get_index<"byuser"_n>();
    for (auto r = by_user.lower_bound(username.value);
         r != by_user.end() && r->username == username; ++r) {
      in_rows += r->money.amount + r->property.amount - r->claimed.amount;
    }
  }
  const auto wallet = Marketplace::get_user_wallet_balance(coopname, ledger2_wallets::MARKETPLACE_INITIATOR, username);
  int64_t legacy = wallet.available.amount - in_rows;
  if (legacy < 0) legacy = 0;

  mkt_invbranch b = *bit;
  mkt_investor row = *it;
  const auto c = MarketInvest::claimable_of(b, row);
  const int64_t total = c.total() + legacy;
  eosio::check(total > 0,
               "MARKETPLACE_INVEST_NOTHING_TO_CLAIM: Возвращённых средств к трансляции пока нет");
  eosio::check(wallet.available.amount >= total,
               "MARKETPLACE_INVEST_WALLET_SHORT: На кошельке паевого взноса в участки меньше суммы к трансляции");

  row.claimed.amount += c.returned;
  if (c.unused > 0) {
    row.money.amount   -= c.unused;
    b.money_total.amount -= c.unused;
    if (row.status == MarketInvest::Status::ACTIVE) b.unused_total.amount -= c.unused;
  }

  const bool nothing_left = row.unused() == 0 && row.claimed.amount >= row.units() &&
                            (row.status == MarketInvest::Status::DONE || row.units() == 0);
  if (nothing_left) {
    MarketInvest::leave_base(b, row);
    b.money_total.amount    -= row.money.amount;
    b.property_total.amount -= row.property.amount;
    by_pair.erase(it);
  } else {
    by_pair.modify(it, RamPayer::of(investors, coopname), [&](auto& x) { x = row; });
  }
  branches.modify(bit, RamPayer::of(branches, coopname), [&](auto& x) { x = b; });

  Ledger2::apply(_marketplace, coopname, operations::marketplace::INVEST_BACK,
                 processes::marketplace::INVEST, eosio::asset(total, _root_govern_symbol), username,
                 claim_hash, Marketplace::Memo::get_invest_back_memo());
  Soviet::make_complete_document(_marketplace, coopname, username, "claiminv"_n,
                                 claim_hash, statement);
}
