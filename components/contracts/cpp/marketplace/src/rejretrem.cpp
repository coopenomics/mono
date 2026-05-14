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
 */
void marketplace::rejretrem(eosio::name coopname,
                             eosio::name chairman,
                             checksum256 request_hash,
                             std::string reason,
                             document2 decision) {
  require_auth(coopname);
  eosio::check(reason.size() > 0 && reason.size() <= 500,
               "rejretrem: reason обязателен (1..500 символов)");

  auto r = Marketplace::get_return_request_by_hash_or_fail(coopname, request_hash);
  eosio::check(r.ku_chairman == chairman,
               "rejretrem: вы не председатель КУ выдачи");
  eosio::check(r.status == ReturnStatus::PENDING_REVIEW,
               "rejretrem: заявление не в pending_review");

  if (!is_empty_document(decision)) {
    verify_document_or_fail(decision, { chairman });
  }

  const auto now = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());
  Marketplace::update_return_request(coopname, r.id, [&](auto& upd) {
    upd.status          = ReturnStatus::REJECTED_REMOTE;
    upd.decision_remote = decision;
    upd.reason_remote   = reason;
    upd.reviewed_at     = now;
    upd.resolved_at     = now;
  });
}
