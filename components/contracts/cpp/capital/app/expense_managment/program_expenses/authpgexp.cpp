/**
 * @brief Авторизует программный расход советом и создаёт исходящий платёж в gateway.
 *
 * @param coopname      Кооператив
 * @param expense_hash  Хеш расхода
 * @param authorization Документ-решение совета
 * @ingroup public_actions
 * @ingroup public_capital_actions
 *
 * @note Авторизация требуется от @p _soviet.
 */
void capital::authpgexp(name coopname, checksum256 expense_hash, document2 authorization) {
  require_auth(_soviet);

  auto expense = Capital::Expenses::get_program_expense_or_fail(coopname, expense_hash);
  eosio::check(expense.status == Capital::Expenses::Status::APPROVED,
               "Программный расход должен быть в статусе 'approved'");

  Capital::Expenses::set_program_authorized(coopname, expense.id, authorization);

  Action::send<createoutpay_interface>(
    _gateway,
    Names::External::CREATE_OUTPAY,
    _capital,
    coopname,
    expense.username,
    expense.expense_hash,
    expense.amount,
    _capital,
    Names::Capital::CONFIRM_PROGRAM_EXPENSE_PAYMENT,
    Names::Capital::DECLINE_PROGRAM_EXPENSE
  );
}
