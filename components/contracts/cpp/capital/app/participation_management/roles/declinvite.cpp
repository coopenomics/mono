/**
 * @brief Кандидат отказывается от инвайта мастера.
 *
 * Отказаться может только тот пайщик, которому приглашение адресовано.
 *
 * @param coopname     Кооператив
 * @param request_hash Хеш инвайт-заявки
 * @param username     Приглашённый пайщик, который отказывается
 * @param reason       Причина отказа
 * @ingroup public_actions
 * @ingroup public_capital_actions
 */
void capital::declinvite(name coopname, checksum256 request_hash, name username, std::string reason) {
  require_auth(coopname);

  auto req = Capital::RoleRequests::get_role_request_or_fail(coopname, request_hash);
  eosio::check(req.direction == Capital::RoleRequests::Direction::INVITE,
               "Отказаться можно только от приглашения");
  eosio::check(req.username == username,
               "Отказаться от приглашения может только тот, кому оно адресовано");

  Capital::RoleRequests::decline(coopname, req.id, reason);

  // Приглашённый и мастер компонента получают уведомление об отказе.
  require_recipient(req.username);
  require_recipient(req.master);
}
