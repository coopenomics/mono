/**
 * @brief Callback от gateway о фактическом подтверждении выплаты
 * материальной помощи (requirement b6 «Экономика КУ», процесс p.brn.aid).
 *
 * Inline-action отправляется контрактом gateway из `gateway::outcomplete`
 * после того, как кассир подтвердил реальный банковский перевод получателю.
 * Здесь — единственное место, где применяется списание. С 2026-08-13
 * кооператив удерживает НДФЛ, поэтому сумма заявления расходится надвое:
 *
 *  - Ledger2::apply(o.brn.aidtax, tax, …, hash=aid.hash) — TRANSFER
 *    w.brn.person → w.brn.ndfl, Дт 86 / Кт 68 (удержанный налог);
 *  - Ledger2::apply(o.brn.aid, net, …, hash=aid.hash) — BURN с
 *    w.brn.person получателя, Дт 86 / Кт 51 (выплата на руки).
 *
 * Ровно ту же сумму `net` кассир увидел в исходящем платеже: она посчитана
 * из `aid.amount` тем же `BranchNdfl`, поэтому расхождения между платёжкой и
 * проводкой быть не может.
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

  // Кооператив — налоговый агент: с персонального кошелька уходит вся сумма
  // заявления, но двумя разными путями. Порядок важен — сначала удержание,
  // потом выплата: если на кошельке не хватает средств (получатель успел
  // перевести их в «Стол заказов»), транзакция упадёт до того, как деньги
  // уйдут получателю, а не после.
  const eosio::asset tax = BranchNdfl::calc_tax(it->amount);
  const eosio::asset net = it->amount - tax;

  if (tax.amount > 0) {
    Ledger2::apply(_branch, coopname,
                   operations::branch::FINANCIAL_AID_TAX,
                   processes::branch::AID,
                   tax, it->username, it->hash,
                   "Удержание налога на доходы физических лиц из материальной помощи");
  }

  Ledger2::apply(_branch, coopname,
                 operations::branch::FINANCIAL_AID,
                 processes::branch::AID,
                 net, it->username, it->hash,
                 "Материальная помощь доверенному кооперативного участка");

  byhash.erase(it);
}
