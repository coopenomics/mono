/**
 * @brief Выделение средств инициаторов участка под расход или материальную
 * помощь, когда общего кошелька участка не хватает (задача 99D-27; вызывает
 * контракт branch при создании служебной записки и одобрении помощи, ИНВ-2).
 *
 * Сумма — сумма записки или заявления, её назвал человек. Средства
 * резервируются в пуле `w.mkt.ipool` без проводки (o.mkt.ipool): деньги уже
 * на расчётном счёте с паевых взносов инициаторов, пул — их назначение.
 * Резерв держится строкой участка; в базу возврата деньги входят, когда
 * расход оплачен (`spentipool`).
 *
 * Guards: авторизация контракта branch; у участка есть вложения; свободных
 * денег инициаторов (неиспользованное минус уже выделенное) не меньше суммы.
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::fundipool(eosio::name coopname, eosio::name braname, eosio::asset amount,
                            checksum256 hash) {
  require_auth(_branch);
  eosio::check(amount.is_valid() && amount.amount > 0 && amount.symbol == _root_govern_symbol,
               "MARKETPLACE_IPOOL_AMOUNT_INVALID: Сумма выделения должна быть больше нуля и в валюте кооператива");
  mkt_invbranches_index branches(_marketplace, coopname.value);
  auto bit = branches.find(braname.value);
  eosio::check(bit != branches.end(),
               "MARKETPLACE_IPOOL_LIMIT: У участка нет средств инициаторов, а общего кошелька участка не хватает");
  const eosio::asset free = bit->unused_total - bit->reserved;
  eosio::check(free >= amount,
               std::string{"MARKETPLACE_IPOOL_LIMIT: Средств инициаторов участка не хватает: нужно "} +
                 amount.to_string() + ", доступно " + free.to_string());

  branches.modify(bit, RamPayer::of(branches, coopname), [&](auto& b) { b.reserved += amount; });
  Ledger2::apply(_marketplace, coopname, operations::marketplace::INVEST_POOL_FUND,
                 processes::marketplace::INVEST, amount, braname, hash,
                 Marketplace::Memo::get_invest_pool_fund_memo());
}
