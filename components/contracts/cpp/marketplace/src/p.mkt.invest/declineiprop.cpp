/**
 * @brief Председатель участка отклоняет заявление о паевом взносе имуществом
 * до передачи в совет (задача 99D-27). Заявление стирается; движений нет.
 *
 * Guards: авторизация кооператива; заявление в статусе «подано»; причина не
 * пустая.
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::declineiprop(eosio::name coopname, eosio::name braname,
                               checksum256 property_hash, std::string reason) {
  require_auth(coopname);
  eosio::check(!reason.empty(), "MARKETPLACE_IPROP_REASON_REQUIRED: Укажите причину отказа");
  const auto prop = MarketInvestProperty::get_or_fail(coopname, property_hash);
  eosio::check(prop.braname == braname,
               "MARKETPLACE_IPROP_BRANCH_MISMATCH: Заявление подано в другой участок");
  eosio::check(prop.status == MarketInvest::PropertyStatus::CREATED,
               "MARKETPLACE_IPROP_STATUS_INVALID: Отклонить можно только заявление до передачи в совет");
  MarketInvestProperty::erase(coopname, prop.id);
}
