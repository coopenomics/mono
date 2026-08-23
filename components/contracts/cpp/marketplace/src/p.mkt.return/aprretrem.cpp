/**
 * @brief Председатель удалённо одобряет очный визит (Story 7.2, p.mkt.return).
 *
 * Без ledger2-операций и без документов. Процедурное действие: статус
 * return_request pending_review → approved_for_visit фиксируется вместе с
 * actor + blockchain_actions[at]. Подпись на документе на удалённом этапе не
 * требуется — она нужна только при принятии возврата (accretrn).
 *
 * Guards:
 *  - Указанный КУ (`braname`) — участок выдачи исходного заказа.
 *  - Подписант (`signer`) авторизован для указанного КУ (`braname`):
 *    председатель / trustee / trusted в `branches[braname]`.
 *  - return_request.status == pending_review.
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::aprretrem(eosio::name coopname,
                             eosio::name signer,
                             eosio::name braname,
                             checksum256 request_hash) {
  require_auth(coopname);

  auto r = Marketplace::get_return_request_by_hash_or_fail(coopname, request_hash);
  eosio::check(r.status == ReturnStatus::PENDING_REVIEW,
               "Заявление не находится на рассмотрении");

  Marketplace::check_return_request_branch(coopname, r, braname);

  auto branch = get_branch_or_fail(coopname, braname);
  eosio::check(branch.is_user_authorized(signer),
               "Подписант не уполномочен принимать решения по заявлениям данного кооперативного участка");

  Marketplace::update_return_request(coopname, r.id, [&](auto& upd) {
    upd.status = ReturnStatus::APPROVED_FOR_VISIT;
  });
}
