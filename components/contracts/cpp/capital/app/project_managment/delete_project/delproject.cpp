/**
 * @brief Удаляет проект
 * Удаляет проект из системы кооператива:
 * - pending: только если коммитов ещё нет (total_commits == 0) и нет дочерних проектов-компонентов; удаляет сегменты и проект
 * - result: если нет компонентов и все сегменты сконвертированы, удаляет проект
 * - неиспользованные средства проекта возвращаются в глобальный пул программы
 * @param coopname Наименование кооператива
 * @param project_hash Хеш проекта для удаления
 * @ingroup public_actions
 * @ingroup public_capital_actions

 * @note Авторизация требуется от аккаунта: @p coopname
 */
void capital::delproject(name coopname, checksum256 project_hash) {
  require_auth(coopname);

  auto project = Capital::Projects::get_project_or_fail(coopname, project_hash);

  const bool is_pending = project.status == Capital::Projects::Status::PENDING;
  const bool is_result = project.status == Capital::Projects::Status::RESULT;
  eosio::check(is_pending || is_result,
               "Проект можно удалить только в статусе pending (без коммитов) или result (все сегменты сконвертированы)");

  eosio::check(!Capital::Projects::has_component_projects(coopname, project_hash),
               "Нельзя удалить проект: есть дочерние проекты-компоненты");

  if (is_pending) {
    eosio::check(project.counts.total_commits == 0,
                 "Нельзя удалить проект с коммитами");
    Capital::Segments::remove_all_project_segments(coopname, project_hash);
  } else {
    // result: как раньше — только после конвертации всех сегментов
    eosio::check(!Capital::Segments::has_project_segments(coopname, project_hash),
                 "Не все сегменты сконвертированы. Сначала конвертируйте все сегменты");
  }

  // Возвращаем неизрасходованные средства проекта в программу. Без этого
  // аллоцированные в проект деньги пропадали бы вместе с записью: строка
  // удалена, а свободные средства программы на них не пополнены.
  Capital::Core::return_unused_investments(coopname, project.id);

  Capital::Projects::delete_project(coopname, project.id);
}