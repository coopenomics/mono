/**
 * @brief Создаёт целевой программный расход и резервирует средства в state.
 *
 * Программный расход — целевое списание программы «Благорост», не привязанное к проекту.
 * Источник средств — пул @c program_expense_pool, наполняемый через @ref capital::topupprogexp.
 *
 * @param coopname     Кооператив
 * @param expense_hash Хеш расхода (анкер процесса p.cap.expns)
 * @param creator      Инициатор (председатель / казначей; авторизуется через coopname)
 * @param amount       Сумма
 * @param description  Описание (для отчётности)
 * @param statement    Документ-заявление (ProgramExpenseStatement)
 * @ingroup public_actions
 * @ingroup public_capital_actions
 *
 * @note Авторизация требуется от @p coopname.
 */
void capital::createpgexp(name coopname, checksum256 expense_hash, name creator,
                          eosio::asset amount, std::string description, document2 statement) {
  require_auth(coopname);

  verify_document_or_fail(statement);
  Wallet::validate_asset(amount);
  eosio::check(amount.amount > 0, "Сумма программного расхода должна быть положительной");

  auto exist = Capital::get_program_expense(coopname, expense_hash);
  eosio::check(!exist.has_value(), "Программный расход с указанным хэшем уже существует");

  // Резервируем средства в пуле программных расходов сразу при создании,
  // чтобы две параллельные заявки не превысили доступный пул.
  Capital::State::reserve_program_expense(coopname, amount);

  Capital::Expenses::create_program_expense(coopname, expense_hash, creator,
                                            amount, description, statement);
}
