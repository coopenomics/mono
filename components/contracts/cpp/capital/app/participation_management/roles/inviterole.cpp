/**
 * @brief Мастер компонента (или председатель — для роли master при пустом слоте мастера)
 *        приглашает кандидата на роль. Обратный поток к requestrole.
 *        Кандидат далее acceptinvite (с применением приглашённой ставки) либо declinvite.
 *
 * Ставка часа в приглашении — это ставка, на которую кандидат соглашается через
 * acceptinvite. Не путать с contributors.rate_per_hour (личная глобальная ставка).
 *
 * @param coopname      Кооператив
 * @param request_hash  Хеш заявки (анкер; уникален в scope coopname)
 * @param project_hash  Проект / компонент
 * @param candidate     Приглашаемый пайщик (потенциальный участник)
 * @param master        Мастер-приглашающий (или координатор/председатель для роли master)
 * @param role          Предлагаемая роль: creator | author | master
 * @param rate_per_hour Предлагаемая ставка часа
 * @param hours_per_day Предлагаемая норма часов в день
 * @param description   Текст приглашения (может быть пустым)
 * @param statement     Инвайт-документ (RoleInviteStatement — Эпик 3)
 * @ingroup public_actions
 * @ingroup public_capital_actions
 */
void capital::inviterole(name coopname, checksum256 request_hash, checksum256 project_hash,
                         name candidate, name master, name role,
                         eosio::asset rate_per_hour, uint64_t hours_per_day,
                         std::string description, document2 statement) {
  require_auth(coopname);

  Capital::RoleRequests::validate_role_or_fail(role);
  verify_document_or_fail(statement);
  Wallet::validate_asset(rate_per_hour);
  eosio::check(rate_per_hour.amount > 0, "Ставка часа должна быть положительной");
  eosio::check(hours_per_day > 0 && hours_per_day <= 8, "Норма часов — от 1 до 8");

  Capital::RoleRequests::create(
    coopname, request_hash, project_hash, candidate, master, role,
    rate_per_hour, hours_per_day,
    Capital::RoleRequests::Direction::INVITE,
    Capital::RoleRequests::RequestType::ROLE,
    description, statement
  );

  // event ridge: кандидат и мастер видят инвайт.
  require_recipient(candidate);
  require_recipient(master);
}
