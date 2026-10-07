/**
 * @brief Председатель подтвердил продление срока.
 *
 * Заём в просрочке возвращается в выданные.
 *
 * @ingroup public_actions
 * @ingroup public_debt_actions

 * @note Авторизация требуется от аккаунта: @p soviet
 */
void debt::loanextok(eosio::name coopname, eosio::name username, checksum256 debt_hash, document2 approved_statement) {
  require_auth(_soviet);

  auto d = Debt::Core::get_debt_or_fail(coopname, debt_hash);
  eosio::check(d.username == username, "Заём принадлежит другому пайщику");
  eosio::check(d.requested_due_at.sec_since_epoch() != 0, "Заявления о продлении нет");

  Debt::Core::modify_debt(coopname, d.id, [&](auto& row) {
    row.due_at = row.requested_due_at;
    row.requested_due_at = eosio::time_point_sec();
    row.extension_statement = approved_statement;
    if (row.status == Debt::Status::OVERDUE) {
      row.status = Debt::Status::ISSUED;
      row.overdue_at = eosio::time_point_sec();
    }
  });

  require_recipient(username);
  require_recipient(coopname);
}
