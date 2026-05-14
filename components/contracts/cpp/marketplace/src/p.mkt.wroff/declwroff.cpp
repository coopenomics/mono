/**
 * @brief Совет отклоняет проект списания скоропорта целиком (Story 8.3, p.mkt.wroff).
 *
 * Без ledger2-операций. Status: PROPOSED → REJECTED (final).
 * reason сохраняется в proposal.reject_reason. Позиции остаются на складах
 * участков и попадут в следующий цикл списания. Отклонить можно только
 * непочатый proposal — если хотя бы одна позиция уже исполнена через
 * execwroff, отклонить целиком запрещено.
 *
 * Guards:
 *  - proposal.status == PROPOSED.
 *  - Ни одна из items не была исполнена (executed == false для всех).
 *  - reason.size() > 0.
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::declwroff(eosio::name coopname,
                             eosio::name decided_by,
                             checksum256 proposal_hash,
                             std::string reason) {
  require_auth(coopname);
  eosio::check(reason.size() > 0 && reason.size() <= 500,
               "Укажите причину отклонения проекта списания (от 1 до 500 символов)");

  auto p = Marketplace::get_writeoff_proposal_by_hash_or_fail(coopname, proposal_hash);
  eosio::check(p.status == WroffStatus::PROPOSED,
               "Проект списания не находится на рассмотрении");

  for (const auto& it : p.items) {
    eosio::check(!it.executed,
                 "Нельзя отклонить проект — часть позиций уже исполнена");
  }

  Marketplace::update_writeoff_proposal(coopname, p.id, [&](auto& upd) {
    upd.status         = WroffStatus::REJECTED;
    upd.decided_by     = decided_by;
    upd.reject_reason  = reason;
  });
}
