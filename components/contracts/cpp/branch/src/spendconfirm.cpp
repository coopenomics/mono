/**
 * @brief Callback от gateway о фактическом подтверждении оплаты расхода КУ
 * (requirement b6 «Экономика КУ», раунд 5; процесс p.brn.spend).
 *
 * Inline-action отправляется контрактом gateway из `gateway::outcomplete`
 * после того, как кассир подтвердил реальный банковский перевод по
 * реквизитам расхода. Здесь — единственное место, где применяется списание:
 *
 *  - Ledger2::apply(o.brn.spend, amount, …, hash=spend.hash) — BURN с
 *    w.brn.common участка, Дт 86 / Кт 51.
 *
 * Guards:
 *  - require_auth(_gateway) — callback легитимен только от gateway-контракта;
 *  - команда найдена по outcome_hash и в статусе pending.
 *
 * @ingroup public_branch_actions
 */
[[eosio::action]] void branch::spendconfirm(eosio::name coopname,
                                             eosio::checksum256 outcome_hash) {
  require_auth(_gateway);

  branch_spends_index spends(_branch, coopname.value);
  auto byhash = spends.get_index<"byhash"_n>();
  auto it = byhash.find(outcome_hash);
  eosio::check(it != byhash.end(),
               "Команда оплаты расхода не найдена по outcome_hash из callback'а gateway");
  eosio::check(it->status == BranchSpendStatus::PENDING,
               "Callback gateway::outcomplete получен на команду не в статусе ожидания оплаты");

  Ledger2::apply(_branch, coopname,
                 operations::branch::SPEND_COMMON,
                 it->amount, it->braname, it->hash,
                 "Оплата расхода кооперативного участка из общего кошелька");

  byhash.modify(it, eosio::same_payer, [&](auto& s) {
    s.status = BranchSpendStatus::COMPLETED;
    s.decline_reason.clear();
  });
}
