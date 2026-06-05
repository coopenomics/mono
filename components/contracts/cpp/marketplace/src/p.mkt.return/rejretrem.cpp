/**
 * @brief Председатель удалённо отказывает в гарантийном возврате (Story 7.2, p.mkt.return).
 *
 * Финальное решение, без ledger2-операций. Статус: pending_review → rejected_remote.
 * reason сохраняется в return_request.reason_remote для UI заказчика.
 *
 * Guards:
 *  - Подписант (`signer`) авторизован для указанного КУ (`braname`).
 *  - return_request.status == pending_review.
 *  - reason.size() > 0.
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::rejretrem(eosio::name coopname,
                             eosio::name signer,
                             eosio::name braname,
                             checksum256 request_hash,
                             std::string reason) {
  require_auth(coopname);
  eosio::check(reason.size() > 0 && reason.size() <= 500,
               "Укажите причину отказа (от 1 до 500 символов)");

  auto branch = get_branch_or_fail(coopname, braname);
  eosio::check(branch.is_user_authorized(signer),
               "Подписант не уполномочен принимать решения по заявлениям данного кооперативного участка");

  auto r = Marketplace::get_return_request_by_hash_or_fail(coopname, request_hash);
  eosio::check(r.status == ReturnStatus::PENDING_REVIEW,
               "Заявление не находится на рассмотрении");

  Marketplace::update_return_request(coopname, r.id, [&](auto& upd) {
    upd.status        = ReturnStatus::REJECTED_REMOTE;
    upd.reason_remote = reason;
  });
}
