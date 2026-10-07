/**
 * @brief Председатель отказал в продлении срока.
 *
 * @ingroup public_actions
 * @ingroup public_debt_actions

 * @note Авторизация требуется от аккаунта: @p soviet
 */
void debt::loanextdecl(eosio::name coopname, eosio::name username, checksum256 debt_hash, std::string reason) {
  require_auth(_soviet);

  auto d = Debt::Core::get_debt_or_fail(coopname, debt_hash);
  eosio::check(d.username == username, "Заём принадлежит другому пайщику");

  Debt::Core::modify_debt(coopname, d.id, [&](auto& row) {
    row.requested_due_at = eosio::time_point_sec();
  });

  require_recipient(username);
  require_recipient(coopname);
}
