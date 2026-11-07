/**
 * @brief Совет отказал в приёме имущества в участок (задача 99D-27).
 * Вызывает только контракт совета. Заявление стирается; движений нет.
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::onipropdecl(eosio::name coopname, checksum256 hash, std::string reason) {
  require_auth(_soviet);
  const auto prop = MarketInvestProperty::get_or_fail(coopname, hash);
  eosio::check(prop.status == MarketInvest::PropertyStatus::APPROVED,
               "MARKETPLACE_IPROP_STATUS_INVALID: Заявление не ожидает решения совета");
  MarketInvestProperty::erase(coopname, prop.id);
}
