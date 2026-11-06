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

  // Предел за месяц освобождается: отклонённое заявление не выплачено, и
  // получатель может подать новое в том же месяце (задача 99D-20). Только
  // если накопитель ведётся по текущему месяцу — строка прошлого месяца уже
  // ничего не ограничивает.
  {
    branch_aidmonths_index months(_branch, coopname.value);
    auto month = months.find(it->username.value);
    const uint32_t period = Branch::utc_month_period(eosio::time_point_sec(eosio::current_time_point()));
    if (month != months.end() && month->period == period) {
      const eosio::asset amount = it->amount;
      months.modify(month, RamPayer::of(months, coopname), [&](auto &m) {
        m.total = m.total >= amount ? m.total - amount : eosio::asset(0, amount.symbol);
      });
    }
  }

  byhash.erase(it);
}
