/**
 * @brief Вносящий подписывает акт приёма-передачи имущества первой подписью
 * (registry 1122; задача 99D-27). Движений нет: имущество принимается второй
 * подписью председателя участка.
 *
 * Guards: авторизация кооператива; решение совета принято; акт подписан
 * вносящим.
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::act1iprop(eosio::name coopname, eosio::name username,
                            checksum256 property_hash, document2 act) {
  require_auth(coopname);
  const auto prop = MarketInvestProperty::get_or_fail(coopname, property_hash);
  eosio::check(prop.username == username,
               "MARKETPLACE_IPROP_NOT_OWNER: Акт подписывает пайщик, подавший заявление");
  eosio::check(prop.status == MarketInvest::PropertyStatus::AUTHORIZED,
               "MARKETPLACE_IPROP_STATUS_INVALID: Акт подписывается после решения совета");
  eosio::check(!is_empty_document(act),
               "MARKETPLACE_IPROP_ACT_MISSING: Отсутствует акт приёма-передачи имущества");
  verify_document_or_fail(act, { username });
  verify_signer_keys_or_fail(act, username);
  MarketInvestProperty::update(coopname, prop.id, [&](auto& row) {
    row.status = MarketInvest::PropertyStatus::ACT1;
    row.act    = act;
  });
}
