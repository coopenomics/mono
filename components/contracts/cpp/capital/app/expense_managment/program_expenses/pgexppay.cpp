/**
 * @brief Подтверждает оплату программного расхода (callback от gateway).
 *
 * Снимает резерв с @c program_expense_reserved, делает ledger2-проводку
 * @ref operations::capital::PAY_EXPENSE (TRANSFER BLAGOROST_FUND → SOV_EXPENSES)
 * и удаляет запись расхода — финал процесса @c p.cap.expns.
 *
 * @param coopname     Кооператив
 * @param expense_hash Хеш расхода
 * @ingroup public_actions
 * @ingroup public_capital_actions
 *
 * @note Авторизация требуется от @p _gateway.
 */
void capital::pgexppay(name coopname, checksum256 expense_hash) {
  require_auth(_gateway);

  auto expense = Capital::Expenses::get_program_expense_or_fail(coopname, expense_hash);
  eosio::check(expense.status == Capital::Expenses::Status::AUTHORIZED,
               "Программный расход должен быть в статусе 'authorized' для подтверждения оплаты");

  // Окончательное списание из резерва (деньги ушли gateway).
  Capital::State::consume_program_expense(coopname, expense.amount);

  // Бухгалтерская/кошельковая проводка.
  auto memo = Capital::Memo::get_expense_pay_memo(expense_hash);
  Ledger2::apply(_capital, coopname,
                 operations::capital::PAY_EXPENSE,
                 expense.amount, expense.username,
                 expense_hash, memo);

  // Запись больше не нужна как ожидающая — закрываем процесс.
  Capital::Expenses::delete_program_expense(coopname, expense.id);
}
