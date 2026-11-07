/**
 * @brief Пайщик подписывает договор участия в хозяйственной деятельности по
 * ЦПП «Стол заказов» (registry 1118; задача 99D-27, решение владельца
 * 07.11.2026). Договор один на пайщика в кооперативе: подписав его один раз,
 * пайщик вносит деньги и имущество в любой кооперативный участок.
 *
 * Движений по средствам нет. Договор публикуется в реестр документов
 * самостоятельным пакетом (package = hash договора).
 *
 * Guards: авторизация кооператива; договор подписан пайщиком его ключом;
 * пайщик активен; договора ещё нет.
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::signinvagr(eosio::name coopname, eosio::name username, document2 agreement) {
  require_auth(coopname);
  eosio::check(!is_empty_document(agreement),
               "MARKETPLACE_INVAGR_MISSING: Отсутствует договор участия в хозяйственной деятельности");
  verify_document_or_fail(agreement, { username });
  // Договор подписывает сам пайщик. Транзакцию шлёт кооператив, поэтому ключ сверяется с аккаунтом.
  verify_signer_keys_or_fail(agreement, username);
  get_active_participant_or_fail(coopname, username);

  mkt_invagreements_index agreements(_marketplace, coopname.value);
  eosio::check(agreements.find(username.value) == agreements.end(),
               "MARKETPLACE_INVAGR_EXISTS: Договор участия в хозяйственной деятельности уже подписан");
  agreements.emplace(RamPayer::of(agreements, coopname), [&](auto& row) {
    row.username  = username;
    row.signed_at = eosio::time_point_sec(eosio::current_time_point());
    row.agreement = agreement;
  });

  Soviet::make_complete_document(_marketplace, coopname, username, "signinvagr"_n,
                                 agreement.hash, agreement);
}
