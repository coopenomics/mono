/**
 * @brief Председатель удалённо одобряет очный визит (Story 7.2, p.mkt.return).
 *
 * Без ledger2-операций. Статус return_request: pending_review → approved_for_visit.
 * decision document сохраняется (опциональный — может быть пустой, тогда решение
 * фиксируется только статусом + actor + blockchain_actions[at]).
 *
 * Guards:
 *  - Подписант (`signer`) авторизован для указанного КУ (`braname`):
 *    председатель / trustee / trusted в `branches[braname]`.
 *  - return_request.status == pending_review.
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::aprretrem(eosio::name coopname,
                             eosio::name signer,
                             eosio::name braname,
                             checksum256 request_hash,
                             document2 decision) {
  require_auth(coopname);

  auto branch = get_branch_or_fail(coopname, braname);
  eosio::check(branch.is_user_authorized(signer),
               "Подписант не уполномочен принимать решения по заявлениям данного кооперативного участка");

  auto r = Marketplace::get_return_request_by_hash_or_fail(coopname, request_hash);
  eosio::check(r.status == ReturnStatus::PENDING_REVIEW,
               "Заявление не находится на рассмотрении");

  if (!is_empty_document(decision)) {
    verify_document_or_fail(decision, { signer });
  }

  Marketplace::update_return_request(coopname, r.id, [&](auto& upd) {
    upd.status          = ReturnStatus::APPROVED_FOR_VISIT;
    upd.decision_remote = decision;
  });
}
