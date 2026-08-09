/**
 * @brief Callback от gateway о фактическом подтверждении выплаты
 * материальной помощи (requirement b6 «Экономика КУ», процесс p.brn.aid).
 *
 * Inline-action отправляется контрактом gateway из `gateway::outcomplete`
 * после того, как кассир подтвердил реальный банковский перевод получателю.
 * Здесь — единственное место, где применяется списание:
 *
 *  - Ledger2::apply(o.brn.aid, amount, …, hash=aid.hash) — BURN с
 *    w.brn.person получателя, Дт 86 / Кт 51.
 *
 * Выплата подтверждена — терминал жизненного цикла: запись заявления стирается
 * из RAM, история — в журнале действий и в решении совета.
 *
 * Guards:
 *  - require_auth(_gateway) — callback легитимен только от gateway-контракта;
 *  - заявление найдено по outcome_hash и одобрено советом (статус authorized):
 *    исходящий платёж создаётся только в `onaidauth`, поэтому иной статус
 *    означал бы выплату в обход решения совета.
 *
 * @ingroup public_branch_actions
 */
[[eosio::action]] void branch::aidconfirm(eosio::name coopname,
                                           eosio::checksum256 outcome_hash) {
  require_auth(_gateway);

  branch_aids_index aids(_branch, coopname.value);
  auto byhash = aids.get_index<"byhash"_n>();
  auto it = byhash.find(outcome_hash);
  eosio::check(it != byhash.end(),
               "Заявление на материальную помощь не найдено по outcome_hash из callback'а gateway");
  eosio::check(it->status == AidStatus::AUTHORIZED,
               "Выплата материальной помощи не одобрена решением совета");

  Ledger2::apply(_branch, coopname,
                 operations::branch::FINANCIAL_AID,
                 it->amount, it->username, it->hash,
                 "Материальная помощь доверенному кооперативного участка");

  byhash.erase(it);
}
