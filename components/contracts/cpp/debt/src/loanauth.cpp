/**
 * @brief Совет разрешил выдачу займа.
 *
 * Решение сохраняется, договор с подписью пайщика уходит председателю на
 * подпись через запросы одобрений.
 *
 * @ingroup public_actions
 * @ingroup public_debt_actions

 * @note Авторизация требуется от аккаунта: @p soviet
 */
void debt::loanauth(eosio::name coopname, checksum256 debt_hash, document2 decision) {
  require_auth(_soviet);

  auto d = Debt::Core::get_debt_or_fail(coopname, debt_hash);
  eosio::check(d.status == Debt::Status::CREATED, "Заём уже рассмотрен советом");

  Debt::Core::modify_debt(coopname, d.id, [&](auto& row) {
    row.status = Debt::Status::AUTHORIZED;
    row.decision = decision;
  });

  ::Soviet::create_approval(_debt, coopname, d.username, d.contract, Names::Debt::SIGN_CONTRACT, debt_hash, _debt,
                            Names::Debt::ON_SIGNED, Names::Debt::ON_SIGN_DECLINE, std::string(""));

  require_recipient(d.username);
  require_recipient(coopname);
}
