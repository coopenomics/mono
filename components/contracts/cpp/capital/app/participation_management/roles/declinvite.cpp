/**
 * @brief Кандидат отказывается от инвайта мастера.
 *
 * @param coopname     Кооператив
 * @param request_hash Хеш инвайт-заявки
 * @param reason       Причина отказа
 * @ingroup public_actions
 * @ingroup public_capital_actions
 */
void capital::declinvite(name coopname, checksum256 request_hash, std::string reason) {
  require_auth(coopname);

  auto req = Capital::RoleRequests::get_role_request_or_fail(coopname, request_hash);
  eosio::check(req.direction == Capital::RoleRequests::Direction::INVITE,
               "Отказаться можно только от инвайта");

  Capital::RoleRequests::decline(coopname, req.id, reason);

  // event ridge: кандидат и мастер видят отказ от инвайта.
  require_recipient(req.username);
  require_recipient(req.master);
}
