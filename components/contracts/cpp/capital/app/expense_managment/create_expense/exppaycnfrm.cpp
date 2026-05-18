/**
 * @brief Подтверждает оплату расхода
 * Подтверждает оплату расхода и завершает процесс:
 * - Получает расход и валидирует его статус (должен быть authorized)
 * - Проверяет регистрацию пользователя
 * - Обновляет used_expense_pool в проекте
 * - Удаляет запись расхода
 * @param coopname Наименование кооператива
 * @param expense_hash Хеш расхода для подтверждения оплаты
 * @ingroup public_actions
 * @ingroup public_capital_actions

 * @note Авторизация требуется от аккаунта: @p _gateway
 */
void capital::exppaycnfrm(eosio::name coopname, checksum256 expense_hash) {
  auto payer = check_auth_and_get_payer_or_fail({ _gateway });
  
  // Получаем расход и проверяем его статус
  auto expense = Capital::Expenses::get_expense_or_fail(coopname, expense_hash);
  eosio::check(expense.status == Capital::Expenses::Status::AUTHORIZED, "Расход должен быть в статусе 'authorized'");
  
  // Проверяем что проект существует
  auto project = Capital::Projects::get_project_or_fail(coopname, expense.project_hash);
  
  // Проверяем что пользователь зарегистрирован
  auto contributor = Capital::Contributors::get_contributor(coopname, expense.username);
  eosio::check(contributor.has_value(), "Договор УХД с пайщиком по проекту не найден");
  
  // Обновляем used_expense_pool в проекте
  Capital::Projects::complete_expense(coopname, project.id, expense.amount);

  // Списываем сумму расхода с программного фонда в пул хозрасходов:
  // TRANSFER BLAGOROST_FUND → SOV_EXPENSES (без Dr/Cr — оба под счётом 80).
  // Бухгалтерская проводка Dr 26 / Cr 51 на расчётном фиксируется gateway отдельно.
  auto memo = Capital::Memo::get_expense_pay_memo(expense_hash);
  Ledger2::apply(_capital, coopname,
                 operations::capital::PAY_EXPENSE,
                 expense.amount, expense.username,
                 expense_hash, memo);

  // Удаляем запись расхода
  Capital::Expenses::delete_expense(coopname, expense.id);
}
