/**
 * @brief Совет отклоняет проект списания скоропорта (Story 8.3, p.mkt.wroff).
 *
 * Без ledger2-операций. Status: proposed → rejected (final).
 * reason сохраняется в proposal.reject_reason. Позиции остаются на складах
 * участков и попадут в следующий цикл списания.
 *
 * Guards:
 *  - proposal.status == proposed.
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
               "declwroff: reason обязателен (1..500 символов)");

  auto p = Marketplace::get_writeoff_proposal_by_hash_or_fail(coopname, proposal_hash);
  eosio::check(p.status == WroffStatus::PROPOSED,
               "declwroff: проект не в статусе proposed");

  const auto now = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());
  Marketplace::update_writeoff_proposal(coopname, p.id, [&](auto& upd) {
    upd.status         = WroffStatus::REJECTED;
    upd.decided_by     = decided_by;
    upd.reject_reason  = reason;
    upd.decided_at     = now;
  });
}
