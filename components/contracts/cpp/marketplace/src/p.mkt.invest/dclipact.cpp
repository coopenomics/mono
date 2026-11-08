/**
 * @brief Председатель совета отказал в подписи акта приёма-передачи имущества
 * (registry 1122; задача 99D-27). Вызывается контрактом совета
 * (`soviet::declineapprv`). Движений нет: заявление возвращается к подписи
 * акта вносящим — решение совета о приёме остаётся в силе, акт формируется
 * и подписывается заново, причина отказа остаётся в журнале действий.
 *
 * `username` — тот, кто отказал (председатель совета), а не вносящий.
 *
 * Guards: только контракт совета; акт подписан вносящим.
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::dclipact(eosio::name coopname, eosio::name username,
                           checksum256 property_hash, std::string reason) {
  require_auth(_soviet);
  const auto prop = MarketInvestProperty::get_or_fail(coopname, property_hash);
  eosio::check(prop.status == MarketInvest::PropertyStatus::ACT1,
               "MARKETPLACE_IPROP_ACT1_REQUIRED: Отказать можно в акте, подписанном вносящим");
  MarketInvestProperty::update(coopname, prop.id, [&](auto& row) {
    row.status = MarketInvest::PropertyStatus::AUTHORIZED;
    row.act    = document2{};
  });
}
