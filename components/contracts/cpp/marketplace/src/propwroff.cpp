/**
 * @brief Backend / админ выносит проект списания скоропорта (Story 8.1, p.mkt.wroff).
 *
 * Без ledger2-операций. Создаётся writeoff_proposal в draft со списком items;
 * total_amount = Σ items.amount.
 *
 * Guards:
 *  - actor backend (auth coopname).
 *  - items.size() > 0.
 *  - Все items.amount > 0 в _root_govern_symbol.
 *
 * @ingroup public_marketplace_actions
 *
 * TODO Story 11.1 (Шаг 6): полная реализация.
 */
void marketplace::propwroff(eosio::name coopname,
                             eosio::name proposed_by,
                             checksum256 proposal_hash,
                             std::vector<wroff_item> items) {
  require_auth(coopname);
  eosio::check(false, "TODO Story 11.1 Шаг 6: propwroff ещё не реализован");
}
