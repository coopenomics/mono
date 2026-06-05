/**
 * @brief Председатель отказывает в гарантийном возврате на очном осмотре (Story 7.3, p.mkt.return).
 *
 * Финальное решение, без ledger2-операций. Статус: approved_for_visit → rejected_at_ku.
 * reason сохраняется в return_request.reason_visit для UI заказчика.
 *
 * Guards:
 *  - Подписант (`signer`) авторизован для указанного КУ (`braname`).
 *  - return_request.status == approved_for_visit.
 *  - reason.size() > 0.
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::rejretrn(eosio::name coopname,
                            eosio::name signer,
                            eosio::name braname,
                            checksum256 request_hash,
                            std::string reason) {
  require_auth(coopname);
  eosio::check(reason.size() > 0 && reason.size() <= 500,
               "Укажите причину отказа (от 1 до 500 символов)");

  auto branch = get_branch_or_fail(coopname, braname);
  eosio::check(branch.is_user_authorized(signer),
               "Подписант не уполномочен принимать решения по возвратам данного кооперативного участка");

  auto r = Marketplace::get_return_request_by_hash_or_fail(coopname, request_hash);
  eosio::check(r.status == ReturnStatus::APPROVED_FOR_VISIT,
               "Заявление не одобрено для очного осмотра");

  Marketplace::update_return_request(coopname, r.id, [&](auto& upd) {
    upd.status       = ReturnStatus::REJECTED_AT_KU;
    upd.reason_visit = reason;
  });
}
