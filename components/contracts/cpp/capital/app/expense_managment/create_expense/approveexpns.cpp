/**
 * @brief Одобряет расход в проекте
 * Одобряет расход в проекте и отправляет в совет:
 * - Проверяет подлинность одобренного заявления
 * - Валидирует статус расхода (должен быть created)
 * - Проверяет что исполнитель является участником проекта
 * - Одобряет расход (обновляет статус)
 * - Отправляет в совет для рассмотрения
 * @param coopname Наименование кооператива
 * @param approver Наименование пользователя-одобряющего
 * @param expense_hash Хеш расхода для одобрения
 * @param approved_statement Одобренное заявление о расходе
 * @ingroup public_actions
 * @ingroup public_capital_actions

 * @note Авторизация требуется от аккаунта: @p coopname
 */
void capital::approveexpns(name coopname, name approver, checksum256 expense_hash, document2 approved_statement) {
  require_auth(coopname);

  verify_document_or_fail(approved_statement);
  // Согласие подписано ключом аккаунта одобряющего. Транзакцию шлёт кооператив, поэтому ключ сверяется с аккаунтом.
  verify_signer_keys_or_fail(approved_statement, approver);
  
  // Получаем расход и проверяем его статус
  auto expense = Capital::Expenses::get_expense_or_fail(coopname, expense_hash);
  eosio::check(expense.status == Capital::Expenses::Status::CREATED, "Расход должен быть в статусе 'created'");
  
  // Проверяем что исполнитель является участником проекта
  auto contributor = Capital::Contributors::get_active_contributor_with_appendix_or_fail(coopname, expense.project_hash, expense.username);
  
  // Одобряем расход (простое обновление статуса)
  Capital::Expenses::set_approved(coopname, expense.id, approved_statement);
  
  // Отправляем в совет
  ::Soviet::create_agenda(
    _capital,
    coopname, 
    expense.username, 
    Names::SovietActions::CAPITAL_RESOLVE_EXPENSE,
    expense_hash, 
    _capital, 
    Names::Capital::AUTHORIZE_EXPENSE,
    Names::Capital::DECLINE_EXPENSE, 
    expense.expense_statement, 
    std::string("")
  );  
}