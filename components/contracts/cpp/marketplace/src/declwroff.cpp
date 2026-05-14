/**
 * @brief Совет отклоняет проект списания скоропорта (Story 8.3, p.mkt.wroff).
 *
 * Без ledger2-операций. Status: draft → rejected (final).
 * reason сохраняется в proposal.reject_reason.
 *
 * Guards:
 *  - proposal.status == draft.
 *  - reason.size() > 0.
 *
 * @ingroup public_marketplace_actions
 *
 * TODO Story 11.1 (Шаг 6): полная реализация.
 */
void marketplace::declwroff(eosio::name coopname,
                             eosio::name decided_by,
                             checksum256 proposal_hash,
                             std::string reason) {
  require_auth(coopname);
  eosio::check(false, "TODO Story 11.1 Шаг 6: declwroff ещё не реализован");
}
