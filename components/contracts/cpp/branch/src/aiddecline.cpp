/**
 * @brief Callback от gateway — банковский перевод материальной помощи не
 * состоялся (requirement b6 «Экономика КУ», процесс p.brn.aid).
 *
 * Ledger2-операция НЕ применяется: средства остаются на персональном
 * кошельке получателя (w.brn.person), он может подать заявку повторно с
 * новым идентификатором.
 *
 * Guards:
 *  - require_auth(_gateway);
 *  - заявка найдена по outcome_hash и в статусе pending.
 *
 * @ingroup public_branch_actions
 */
[[eosio::action]] void branch::aiddecline(eosio::name coopname,
                                           eosio::checksum256 outcome_hash,
                                           std::string reason) {
  require_auth(_gateway);

  branch_aids_index aids(_branch, coopname.value);
  auto byhash = aids.get_index<"byhash"_n>();
  auto it = byhash.find(outcome_hash);
  eosio::check(it != byhash.end(),
               "Заявка на материальную помощь не найдена по outcome_hash из callback'а gateway");
  eosio::check(it->status == BranchAidStatus::PENDING,
               "Callback gateway::outdecline получен на заявку не в статусе ожидания выплаты");

  byhash.modify(it, eosio::same_payer, [&](auto& a) {
    a.status         = BranchAidStatus::DECLINED;
    a.decline_reason = reason;
  });
}
