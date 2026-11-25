/**
 * @brief Пайщик подписывает договор об участии в хозяйственной деятельности
 * кооперативного участка (registry 1118; задачи 99D-27, 99D-35).
 *
 * Договор заключается на каждый участок отдельно (решение владельца
 * 12.11.2026; прежнее решение 07.11.2026 «один договор на пайщика» отменено):
 * в тексте договора названы участок и его председатель, паевые взносы
 * деньгами и имуществом пайщик вносит только в участок своего договора.
 *
 * Движений по средствам нет. Договор публикуется в реестр документов
 * самостоятельным пакетом (package = hash договора).
 *
 * Guards: авторизация кооператива; договор подписан пайщиком его ключом;
 * пайщик активен; участок существует; договора с этим участком ещё нет.
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::signinvagr(eosio::name coopname, eosio::name username, eosio::name braname, document2 agreement) {
  require_auth(coopname);
  eosio::check(!is_empty_document(agreement),
               "MARKETPLACE_INVAGR_MISSING: Отсутствует договор участия в хозяйственной деятельности");
  verify_document_or_fail(agreement, { username });
  // Договор подписывает сам пайщик. Транзакцию шлёт кооператив, поэтому ключ сверяется с аккаунтом.
  verify_signer_keys_or_fail(agreement, username);
  get_active_participant_or_fail(coopname, username);
  get_branch_or_fail(coopname, braname);

  eosio::check(!MarketInvest::has_agreement(coopname, username, braname),
               "MARKETPLACE_INVAGR_EXISTS: Договор участия в хозяйственной деятельности этого участка уже подписан");
  mkt_invagreements_index agreements(_marketplace, coopname.value);
  agreements.emplace(RamPayer::of(agreements, coopname), [&](auto& row) {
    row.id        = agreements.available_primary_key();
    row.username  = username;
    row.braname   = braname;
    row.signed_at = eosio::time_point_sec(eosio::current_time_point());
    row.agreement = agreement;
  });

  Soviet::make_complete_document(_marketplace, coopname, username, "signinvagr"_n,
                                 agreement.hash, agreement);
}
