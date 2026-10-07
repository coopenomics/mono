/**
 * @brief Кассир выплатил заём.
 *
 * Сумма переходит с кошелька «к выдаче» в кошелёк выданных займов
 * (Дт 76 / Кт 51), заём считается выданным, идёт срок возврата.
 *
 * @ingroup public_actions
 * @ingroup public_debt_actions

 * @note Авторизация требуется от аккаунта: @p gateway
 */
void debt::loanpaid(eosio::name coopname, checksum256 debt_hash) {
  require_auth(_gateway);

  auto d = Debt::Core::get_debt_or_fail(coopname, debt_hash);
  eosio::check(d.status == Debt::Status::PAYING, "Выплату подтверждают по займу, переданному кассиру");

  Debt::Core::modify_debt(coopname, d.id, [&](auto& row) {
    row.status = Debt::Status::ISSUED;
    row.issued_at = Debt::Core::now();
    row.last_pay_error.clear();
  });

  Ledger2::apply(_debt, coopname, operations::debt::LEND, processes::debt::LOAN, d.amount, d.username, debt_hash,
                 Debt::Memo::get_lend_memo(debt_hash));
  Debt::Core::change_summary(coopname, d.username, d.amount);

  require_recipient(d.username);
  require_recipient(coopname);
}
