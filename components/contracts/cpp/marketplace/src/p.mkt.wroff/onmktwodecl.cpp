/**
 * @brief Callback от `soviet` после отказа в Протоколе совета о списании
 * скоропорта или истечения срока повестки (Story 8.4, p.mkt.wroff).
 *
 * Сигнатура `(coopname, hash, reason)` соответствует
 * `DECLINE_CALLBACK_SIGNATURE` (см. `cpp/lib/core/soviet/soviet.hpp:19`).
 * Контракт `soviet` вызывает action из `cancelexprd` (повестка просрочена)
 * или вручную через `decline*` actions от своего имени, поэтому единственно
 * допустимая авторизация — `_soviet`.
 *
 * Эффект:
 *  - Находит wroffprops по proposal_hash == `hash`.
 *  - Проверяет, что текущий статус == PROPOSED.
 *  - Записывает `reason` в `proposal.reject_reason`.
 *  - Переводит статус PROPOSED → REJECTED.
 *
 * Без ledger2-движений.
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::onmktwodecl(eosio::name coopname,
                               checksum256 hash,
                               std::string reason) {
  require_auth(_soviet);

  auto p = Marketplace::get_writeoff_proposal_by_hash_or_fail(coopname, hash);
  eosio::check(p.status == WroffStatus::PROPOSED,
               "Проект списания не находится на повестке (callback повторный или поздний)");

  Marketplace::update_writeoff_proposal(coopname, p.id, [&](auto& upd) {
    upd.status        = WroffStatus::REJECTED;
    upd.reject_reason = reason;
  });
}
