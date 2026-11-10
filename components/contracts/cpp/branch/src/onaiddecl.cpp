/**
 * @brief Callback контракта Soviet — совет отказал в выплате материальной
 * помощи либо срок рассмотрения заявления истёк (requirement b6, p.brn.aid).
 *
 * Приходит inline-вызовом из `soviet::decline_and_erase_decision` (голоса
 * «против» либо просрочка повестки). Заявление закрывается, не доходя до
 * кассира: исходящий платёж не создавался, ledger2-операций не было, средства
 * так и остались на персональном кошельке получателя — он может распорядиться
 * ими иначе или подать заявление повторно.
 *
 * Guards:
 *  - require_auth(_soviet);
 *  - заявление найдено по hash решения и находится в статусе proposed
 *    (одобренное заявление отзывается уже кассиром через `aiddecline`).
 *
 * @ingroup public_branch_actions
 */
[[eosio::action]] void branch::onaiddecl(eosio::name coopname,
                                          eosio::checksum256 hash,
                                          std::string reason) {
  require_auth(_soviet);

  branch_aids_index aids(_branch, coopname.value);
  auto byhash = aids.get_index<"byhash"_n>();
  auto it = byhash.find(hash);
  eosio::check(it != byhash.end(),
               "Заявление на материальную помощь не найдено по идентификатору решения совета");
  // Отказать можно только пока решение не принято. Уже одобренную выплату
  // откатить нельзя ничем — ни советом, ни кассиром.
  eosio::check(it->status == AidStatus::PROPOSED,
               "Решение о выплате материальной помощи уже принято и откату не подлежит");

  // Право получателя восстанавливается: отклонённое заявление не выплачено,
  // и получатель может подать новое (задача 99D-34). Право ведётся только при
  // включённом потолке — так же, как его списывает createaid.
  if (Branch::aid_month_limit(coopname).amount > 0) {
    branch_reserves_index reserves(_branch, coopname.value);
    auto ridx = reserves.get_index<"bybruser"_n>();
    auto rit = ridx.find(combine_ids(it->braname.value, it->username.value));
    if (rit != ridx.end()) {
      const uint32_t period = Branch::aid_period(coopname, eosio::time_point_sec(eosio::current_time_point()));
      const eosio::asset available = Branch::outstanding_of(coopname, *rit, period);
      const eosio::asset amount = it->amount;
      ridx.modify(rit, RamPayer::of(ridx, coopname), [&](auto &r) {
        r.accrued_period = period;
        r.outstanding = available + amount;
      });
    }
  }

  // Совет отказал: сумма заявления возвращается на персональный кошелёк либо в средства инициаторов — по источнику, выбранному при подаче.
  if (it->source.has_value() && it->source.value() == ledger2_wallets::BRANCH_AID_REQUEST) {
    Ledger2::apply(_branch, coopname, operations::branch::AID_RETURN, processes::branch::AID,
                   it->amount, it->username, it->hash,
                   "Сумма заявления на материальную помощь возвращена после отказа совета");
  } else if (it->source.has_value() && it->source.value() == ledger2_wallets::MARKETPLACE_INVEST_POOL) {
    MarketInvest::unfund_pool(_branch, coopname, it->braname, it->amount, it->hash);
  }
  byhash.erase(it);
}
