/**
 * @brief Председатель удалённо одобряет очный визит (Story 7.2, p.mkt.return).
 *
 * Без ledger2-операций. Статус return_request: pending_review → approved_for_visit.
 * decision document сохраняется (опциональный — может быть пустой, тогда решение
 * фиксируется только статусом + timestamp + actor).
 *
 * Guards:
 *  - actor == return_request.ku_chairman.
 *  - return_request.status == pending_review.
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::aprretrem(eosio::name coopname,
                             eosio::name chairman,
                             checksum256 request_hash,
                             document2 decision) {
  require_auth(coopname);

  auto r = Marketplace::get_return_request_by_hash_or_fail(coopname, request_hash);
  eosio::check(r.ku_chairman == chairman,
               "aprretrem: вы не председатель КУ выдачи");
  eosio::check(r.status == ReturnStatus::PENDING_REVIEW,
               "aprretrem: заявление не в pending_review");

  if (!is_empty_document(decision)) {
    verify_document_or_fail(decision, { chairman });
  }

  const auto now = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());
  Marketplace::update_return_request(coopname, r.id, [&](auto& upd) {
    upd.status          = ReturnStatus::APPROVED_FOR_VISIT;
    upd.decision_remote = decision;
    upd.reviewed_at     = now;
  });
}
