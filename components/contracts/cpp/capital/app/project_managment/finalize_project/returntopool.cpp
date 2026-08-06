/**
 * @brief Возвращает неиспользованные инвестиции в глобальный пул программы
 * Трекинговое действие для возврата неиспользованной дельты инвестиций:
 * - Вызывается через inline action из finalizeproj, delproject и declprj
 * - Фиксирует сумму и проект для трекинга
 * - Добавляет средства в глобальный пул программы кооператива
 * @param coopname Наименование кооператива
 * @param project_hash Хеш проекта, из которого возвращаются средства
 * @param amount Сумма неиспользованных инвестиций для возврата
 * @ingroup public_actions
 * @ingroup public_capital_actions

 * @note Авторизация требуется от аккаунта: @p _capital (inline action)
 * @note Это действие предназначено для вызова из finalizeproj / delproject / declprj и трекинга возвратов
 */
void capital::returntopool(eosio::name coopname, checksum256 project_hash, eosio::asset amount) {
  require_auth(_capital);

  // Валидация суммы
  Wallet::validate_asset(amount);
  eosio::check(amount.amount > 0, "Сумма возврата должна быть положительной");

  // Проект может уже не существовать: при удалении и отклонении возврат уходит
  // inline-действием, а оно исполняется после того, как строка проекта стёрта.
  // Хэш в этом случае остаётся только меткой для трекинга.
  auto project = Capital::Projects::get_project(coopname, project_hash);

  // Добавляем средства в глобальный пул программы
  Capital::Core::add_program_investment_funds(coopname, amount);

  print("Возвращено в глобальный пул из проекта ",
        project.has_value() ? project->title : std::string("(удалён)"), ": ", amount.to_string());
}

