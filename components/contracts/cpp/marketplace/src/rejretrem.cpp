/**
 * @brief Председатель удалённо отказывает в гарантийном возврате (Story 7.2, p.mkt.return).
 *
 * Финальное решение, без ledger2-операций. Статус: pending_review → rejected_remote.
 * reason сохраняется в return_request.reason_remote для UI заказчика.
 *
 * Guards:
 *  - actor == return_request.ku_chairman.
 *  - return_request.status == pending_review.
 *  - reason.size() > 0.
 *
 * @ingroup public_marketplace_actions
 *
 * TODO Story 11.1 (Шаг 5): полная реализация.
 */
void marketplace::rejretrem(eosio::name coopname,
                             eosio::name chairman,
                             checksum256 request_hash,
                             std::string reason,
                             document2 decision) {
  require_auth(coopname);
  eosio::check(false, "TODO Story 11.1 Шаг 5: rejretrem ещё не реализован");
}
