/**
 * @brief Председатель удалённо одобряет очный визит (Story 7.2, p.mkt.return).
 *
 * Без ledger2-операций. Статус return_request: pending_review → approved_for_visit.
 *
 * Guards:
 *  - actor == return_request.ku_chairman.
 *  - return_request.status == pending_review.
 *
 * @ingroup public_marketplace_actions
 *
 * TODO Story 11.1 (Шаг 5): полная реализация.
 */
void marketplace::aprretrem(eosio::name coopname,
                             eosio::name chairman,
                             checksum256 request_hash,
                             document2 decision) {
  require_auth(coopname);
  eosio::check(false, "TODO Story 11.1 Шаг 5: aprretrem ещё не реализован");
}
