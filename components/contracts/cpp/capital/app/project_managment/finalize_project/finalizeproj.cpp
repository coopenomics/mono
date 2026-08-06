/**
 * @brief Финализирует проект после завершения всех конвертаций
 * Финализирует проект и передаёт все неиспользованные инвестиции в глобальный фонд:
 * - Проверяет что проект в статусе RESULT
 * - Проверяет что все сегменты сконвертированы (нет оставшихся сегментов)
 * - Рассчитывает неиспользованную дельту инвестиций на основе total_used_for_compensation
 * - Передаёт неиспользованную дельту в глобальный пул программы кооператива
 * - Устанавливает статус проекта на FINALIZED
 * 
 * Неиспользованные инвестиции включают:
 * - Прямые инвестиции инвесторов (investor_amount), которые не были использованы проектом
 *   (средства инвесторов идут сразу в _capital_program, возврат инвесторам запрещён)
 * - Аллоцированные программные средства, которые не были использованы
 * 
 * @param coopname Наименование кооператива
 * @param project_hash Хеш проекта для финализации
 * @ingroup public_actions
 * @ingroup public_capital_actions

 * @note Авторизация требуется от аккаунта: @p coopname
 * @note Экшен должен вызываться после того, как все участники выполнили convertsegm
 */
void capital::finalizeproj(eosio::name coopname, checksum256 project_hash) {
  require_auth(coopname);

  // Получаем проект
  auto project = Capital::Projects::get_project_or_fail(coopname, project_hash);

  // Проверяем что проект в статусе RESULT
  eosio::check(project.status == Capital::Projects::Status::RESULT,
               "Проект должен быть в статусе RESULT для финализации");

  // Проверяем что все участники сконвертировали свои сегменты
  eosio::check(Capital::Projects::are_all_segments_converted(coopname, project.id),
               "Не все участники сконвертировали свои сегменты. Дождитесь завершения конвертации всеми участниками.");
               
  // Дополнительная проверка что в таблице сегментов ничего не осталось
  eosio::check(!Capital::Segments::has_project_segments(coopname, project_hash), 
               "В таблице сегментов остались записи. Ошибка синхронизации.");

  // Рассчитываем неиспользованную дельту инвестиций
  //
  // Неиспользованная дельта включает:
  // 1. Инвестиции инвесторов, не использованные проектом (investor_amount - investor_base для каждого)
  // 2. Аллоцированные программные средства, не использованные проектом
  // 3. Зарезервированные на расходы (accumulated_expense_pool), но не потраченные (used_expense_pool)
  //
  // Средства инвесторов уже в _capital_program (благорост) - возврат инвесторам запрещён.
  // Все неиспользованные средства передаются в глобальный фонд для дальнейшего использования.
  // Формула общая для finalizeproj / delproject / declprj — см. calculate_unused_investments.

  Capital::Projects::return_unused_investments_to_pool(coopname, project);

  // Устанавливаем статус проекта на FINALIZED
  Capital::Projects::update_status(coopname, project.id, Capital::Projects::Status::FINALIZED);
  
}

