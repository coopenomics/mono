/**
 * @brief Председатель отказывает в гарантийном возврате на очном осмотре (Story 7.3, p.mkt.return).
 *
 * Финальное решение, без ledger2-операций. Статус: approved_for_visit → rejected_at_ku.
 * reason сохраняется в return_request.reason_visit для UI заказчика.
 *
 * Guards:
 *  - actor == return_request.ku_chairman.
 *  - return_request.status == approved_for_visit.
 *  - reason.size() > 0.
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::rejretrn(eosio::name coopname,
                            eosio::name chairman,
                            checksum256 request_hash,
                            std::string reason,
                            document2 decision) {
  require_auth(coopname);
  eosio::check(reason.size() > 0 && reason.size() <= 500,
               "rejretrn: reason обязателен (1..500 символов)");

  auto r = Marketplace::get_return_request_by_hash_or_fail(coopname, request_hash);
  eosio::check(r.ku_chairman == chairman,
               "rejretrn: вы не председатель КУ выдачи");
  eosio::check(r.status == ReturnStatus::APPROVED_FOR_VISIT,
               "rejretrn: заявление не в approved_for_visit");

  if (!is_empty_document(decision)) {
    verify_document_or_fail(decision, { chairman });
  }

  Marketplace::update_return_request(coopname, r.id, [&](auto& upd) {
    upd.status         = ReturnStatus::REJECTED_AT_KU;
    upd.decision_visit = decision;
    upd.reason_visit   = reason;
  });
}
