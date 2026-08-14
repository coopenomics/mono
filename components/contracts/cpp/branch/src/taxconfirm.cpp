/**
 * @brief Callback от gateway о фактическом перечислении удержанного НДФЛ в
 * бюджет (requirement b6 «Экономика КУ», решение владельца 2026-08-13).
 *
 * Inline-action отправляется контрактом gateway из `gateway::outcomplete`
 * после того, как кассир подтвердил реальный перевод по реквизитам налоговой.
 * Здесь — единственное место, где применяется списание:
 *
 *  - Ledger2::apply(o.brn.taxpay, amount, …, hash=tax.hash) — BURN с
 *    w.brn.ndfl, Дт 68 / Кт 51: обязательство перед бюджетом закрывается.
 *
 * Платёж подтверждён — терминал жизненного цикла: запись заявки стирается из
 * RAM, история остаётся в журнале действий.
 *
 * Guards:
 *  - require_auth(_gateway) — callback легитимен только от gateway-контракта;
 *  - заявка найдена по outcome_hash.
 *
 * @ingroup public_branch_actions
 */
[[eosio::action]] void branch::taxconfirm(eosio::name coopname,
                                           eosio::checksum256 outcome_hash) {
  require_auth(_gateway);

  branch_taxes_index taxes(_branch, coopname.value);
  auto byhash = taxes.get_index<"byhash"_n>();
  auto it = byhash.find(outcome_hash);
  eosio::check(it != byhash.end(),
               "Заявка на перечисление налога не найдена по outcome_hash из callback'а gateway");

  Ledger2::apply(_branch, coopname,
                 operations::branch::TAX_PAYMENT,
                 processes::branch::AID,
                 it->amount, coopname, it->hash,
                 "Перечисление удержанного налога на доходы физических лиц в бюджет");

  byhash.erase(it);
}
