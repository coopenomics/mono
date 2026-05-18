/**
 * @brief Мастер компонента приглашает кандидата на роль (обратный поток к requestrole).
 *        Кандидат далее acceptinvite (с применением approved-rate) либо declinvite.
 *
 * @param coopname      Кооператив
 * @param request_hash  Хеш заявки (анкер; уникален в scope coopname)
 * @param project_hash  Проект / компонент
 * @param candidate     Приглашаемый пайщик (потенциальный участник)
 * @param master        Мастер-приглашающий
 * @param role          Предлагаемая роль
 * @param rate_per_hour Предлагаемая ставка часа
 * @param hours_per_day Предлагаемая норма часов
 * @param statement     Инвайт-документ (RoleInviteStatement — Эпик 3)
 * @ingroup public_actions
 * @ingroup public_capital_actions
 */
void capital::inviterole(name coopname, checksum256 request_hash, checksum256 project_hash,
                         name candidate, name master, name role,
                         eosio::asset rate_per_hour, uint64_t hours_per_day,
                         document2 statement) {
  require_auth(coopname);

  verify_document_or_fail(statement);
  Wallet::validate_asset(rate_per_hour);
  eosio::check(rate_per_hour.amount > 0, "Ставка часа должна быть положительной");
  eosio::check(hours_per_day > 0 && hours_per_day <= 12, "Норма часов — от 1 до 12");

  Capital::RoleRequests::create(
    coopname, request_hash, project_hash, candidate, master, role,
    rate_per_hour, hours_per_day,
    Capital::RoleRequests::Direction::INVITE,
    Capital::RoleRequests::RequestType::ROLE,
    statement
  );
}
