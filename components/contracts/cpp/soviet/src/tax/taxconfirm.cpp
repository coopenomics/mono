/**
 * @brief Callback от gateway о фактическом перечислении удержанного НДФЛ в
 * бюджет (решение владельца 2026-08-13).
 *
 * Inline-action отправляется контрактом gateway из `gateway::outcomplete`
 * после того, как кассир подтвердил реальный перевод по реквизитам налоговой.
 * Здесь — единственное место, где применяется списание:
 *
 *  - Ledger2::apply(o.sov.taxpay, amount, …, hash=tax.hash) — BURN с
 *    w.sov.ndfl, Дт 68 / Кт 51: обязательство перед бюджетом закрывается.
 *
 * Платёж подтверждён — терминал жизненного цикла: запись заявки стирается из
 * RAM, история остаётся в журнале действий.
 *
 * Guards:
 *  - require_auth(_gateway) — callback легитимен только от gateway-контракта;
 *  - заявка найдена по outcome_hash.
 *
 * @ingroup public_soviet_actions
 */
[[eosio::action]] void soviet::taxconfirm(eosio::name coopname,
                                           eosio::checksum256 outcome_hash) {
  require_auth(_gateway);

  soviet_taxes_index taxes(_soviet, coopname.value);
  auto byhash = taxes.get_index<"byhash"_n>();
  auto it = byhash.find(outcome_hash);
  eosio::check(it != byhash.end(),
               "Заявка на перечисление налога не найдена по outcome_hash из callback'а gateway");

  Ledger2::apply(_soviet, coopname,
                 operations::soviet::TAX_PAYMENT,
                 processes::soviet::TAX,
                 it->amount, coopname, it->hash,
                 "Перечисление удержанного налога на доходы физических лиц в бюджет");

  byhash.erase(it);
}
