/**
 * @brief Совет принял решение о приёме имущества в участок (протокол 1121;
 * задача 99D-27). Вызывает только контракт совета после утверждения решения.
 * Дальше вносящий подписывает акт первой подписью (`act1iprop`).
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::onipropauth(eosio::name coopname, checksum256 hash, document2 authorization) {
  require_auth(_soviet);
  const auto prop = MarketInvestProperty::get_or_fail(coopname, hash);
  eosio::check(prop.status == MarketInvest::PropertyStatus::APPROVED,
               "MARKETPLACE_IPROP_STATUS_INVALID: Заявление не ожидает решения совета");
  MarketInvestProperty::update(coopname, prop.id, [&](auto& row) {
    row.status   = MarketInvest::PropertyStatus::AUTHORIZED;
    row.decision = authorization;
  });
}
