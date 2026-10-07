/**
 * @brief Заявление пайщика о продлении срока возврата.
 *
 * Новый срок вступает в силу после подтверждения председателем через запросы
 * одобрений.
 *
 * @ingroup public_actions
 * @ingroup public_debt_actions

 * @note Авторизация требуется от аккаунта: @p coopname
 */
void debt::extendloan(eosio::name coopname, eosio::name username, checksum256 debt_hash,
                      eosio::time_point_sec new_due_at, document2 statement) {
  require_auth(coopname);

  auto d = Debt::Core::get_debt_or_fail(coopname, debt_hash);
  eosio::check(d.username == username, "Заём принадлежит другому пайщику");
  eosio::check(d.status == Debt::Status::ISSUED || d.status == Debt::Status::OVERDUE, "Продлить можно выданный заём");
  eosio::check(d.source == _debt, "Срок займа другого приложения продлевается в нём");
  eosio::check(d.requested_due_at.sec_since_epoch() == 0, "Предыдущее заявление о продлении ещё не рассмотрено");
  eosio::check(new_due_at > Debt::Core::now() && new_due_at > d.due_at, "Новый срок должен быть позже текущего");
  eosio::check(!is_empty_document(statement), "Нужно заявление о продлении с подписью пайщика");
  verify_document_or_fail(statement, {username});
  verify_signer_keys_or_fail(statement, username);

  Debt::Core::modify_debt(coopname, d.id, [&](auto& row) {
    row.requested_due_at = new_due_at;
    row.extension_statement = statement;
  });

  ::Soviet::create_approval(_debt, coopname, username, statement, Names::Debt::EXTEND_TERM, debt_hash, _debt,
                            Names::Debt::ON_EXTEND_OK, Names::Debt::ON_EXTEND_DECL, std::string(""));

  require_recipient(username);
  require_recipient(coopname);
}
