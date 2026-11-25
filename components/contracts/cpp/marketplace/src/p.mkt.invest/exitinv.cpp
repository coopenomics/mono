/**
 * @brief Выход инициатора из кооператива одобрен: пайщик снимается со строк
 * паевых взносов всех участков (задача 99D-27, решение владельца 07.11.2026).
 * Вызывает только registrator при одобрении выхода. Кошелёк договора участия
 * переносится на главный паевой политикой выхода (o.mkt.iexit) в той же
 * транзакции; здесь его база вычитается из базы возврата участков, и
 * дальнейшие возвраты экономии ему не идут.
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::exitinv(eosio::name coopname, eosio::name username) {
  require_auth(_registrator);
  mkt_investors_index investors(_marketplace, coopname.value);
  mkt_invbranches_index branches(_marketplace, coopname.value);
  auto by_user = investors.get_index<"byuser"_n>();
  for (auto it = by_user.lower_bound(username.value);
       it != by_user.end() && it->username == username;
       it = by_user.lower_bound(username.value)) {
    auto bit = branches.find(it->braname.value);
    if (bit != branches.end()) {
      mkt_invbranch b = *bit;
      mkt_investor row = *it;
      MarketInvest::leave_base(b, row);
      if (row.unused() > 0) b.unused_total.amount -= row.unused();
      b.money_total.amount    -= row.money.amount;
      b.property_total.amount -= row.property.amount;
      branches.modify(bit, RamPayer::of(branches, coopname), [&](auto& x) { x = b; });
    }
    by_user.erase(it);
  }
}
