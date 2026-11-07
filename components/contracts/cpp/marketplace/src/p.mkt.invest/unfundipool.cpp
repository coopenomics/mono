/**
 * @brief Возврат невыделенного остатка средств инициаторов из пула (задача
 * 99D-27; вызывает контракт branch): совет отклонил записку, расход закрыт на
 * меньшую сумму, помощь отменена. Резерв участка уменьшается, пул сжигается
 * без проводки (o.mkt.iunpool). Деньги инициаторов снова свободны.
 *
 * Guards: авторизация контракта branch; резерв участка не меньше суммы.
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::unfundipool(eosio::name coopname, eosio::name braname, eosio::asset amount,
                              checksum256 hash) {
  require_auth(_branch);
  eosio::check(amount.is_valid() && amount.amount > 0 && amount.symbol == _root_govern_symbol,
               "MARKETPLACE_IPOOL_AMOUNT_INVALID: Сумма возврата должна быть больше нуля и в валюте кооператива");
  mkt_invbranches_index branches(_marketplace, coopname.value);
  auto bit = branches.find(braname.value);
  eosio::check(bit != branches.end() && bit->reserved >= amount,
               "MARKETPLACE_IPOOL_RESERVE_EXCEEDED: Возврат больше выделенного под расходы участка");
  branches.modify(bit, RamPayer::of(branches, coopname), [&](auto& b) { b.reserved -= amount; });
  Ledger2::apply(_marketplace, coopname, operations::marketplace::INVEST_POOL_UNFUND,
                 processes::marketplace::INVEST, amount, braname, hash,
                 Marketplace::Memo::get_invest_pool_unfund_memo());
}
