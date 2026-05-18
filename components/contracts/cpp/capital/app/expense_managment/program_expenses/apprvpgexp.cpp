/**
 * @brief Одобряет программный расход председателем и отправляет в совет.
 *
 * @param coopname           Кооператив
 * @param approver           Председатель (или доверенный)
 * @param expense_hash       Хеш расхода
 * @param approved_statement Принятая записка (с подписью председателя)
 * @ingroup public_actions
 * @ingroup public_capital_actions
 *
 * @note Авторизация требуется от @p coopname.
 */
void capital::apprvpgexp(name coopname, name approver, checksum256 expense_hash,
                         document2 approved_statement) {
  require_auth(coopname);

  verify_document_or_fail(approved_statement);

  auto expense = Capital::Expenses::get_program_expense_or_fail(coopname, expense_hash);
  eosio::check(expense.status == Capital::Expenses::Status::CREATED,
               "Программный расход должен быть в статусе 'created'");

  Capital::Expenses::set_program_approved(coopname, expense.id, approved_statement);

  ::Soviet::create_agenda(
    _capital,
    coopname,
    expense.username,
    Names::SovietActions::CAPITAL_RESOLVE_PROGRAM_EXPENSE,
    expense_hash,
    _capital,
    Names::Capital::AUTHORIZE_PROGRAM_EXPENSE,
    Names::Capital::DECLINE_PROGRAM_EXPENSE,
    expense.expense_statement,
    std::string("")
  );
}
