/**
 * @brief Председатель удалённо отказывает в гарантийном возврате (Story 7.2, p.mkt.return).
 *
 * Финальное решение, без ledger2-операций — терминал жизненного цикла:
 * запись заявления стирается из RAM, причина отказа остаётся в журнале
 * действий (аргумент reason).
 *
 * Guards:
 *  - Указанный КУ (`braname`) — участок выдачи исходного заказа.
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

  auto r = Marketplace::get_return_request_by_hash_or_fail(coopname, request_hash);
  eosio::check(r.status == ReturnStatus::PENDING_REVIEW,
               "Заявление не находится на рассмотрении");

  Marketplace::check_return_request_branch(coopname, r, braname);

  auto branch = get_branch_or_fail(coopname, braname);
  eosio::check(branch.is_user_authorized(signer),
               "Подписант не уполномочен принимать решения по заявлениям данного кооперативного участка");

  // Запись реестра документов (создана newsubmitted в submretrn) доводится
  // до «отклонён»; причина отказа остаётся в журнале действий (reason).
  Action::send<newdeclined_interface>(_soviet, "newdeclined"_n, _marketplace,
                                      coopname, r.orderer,
                                      r.original_order_hash, r.statement);

  Marketplace::erase_return_request(coopname, r.id);
}
