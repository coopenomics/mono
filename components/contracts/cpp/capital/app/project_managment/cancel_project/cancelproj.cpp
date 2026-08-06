/**
 * @brief Отменяет проект
 * Прекращает работу над проектом без возможности возобновления:
 * - Возвращает неизрасходованные средства в программу
 * - Удаляет сегменты участников и саму запись проекта
 *
 * Отмена доступна в любом рабочем статусе — в отличие от удаления
 * (delproject), которое требует отсутствия коммитов. Отменять нечего, когда
 * проект уже финализирован: его средства возвращены, а работы завершены.
 *
 * Запись проекта стирается: оперативная память цепи хранит только то, с чем
 * идёт работа. Отменённый проект работой не является, его история остаётся
 * в учётной системе кооператива, которая ведёт её по действиям цепи.
 *
 * @param coopname Наименование кооператива
 * @param project_hash Хеш проекта для отмены
 * @ingroup public_actions
 * @ingroup public_capital_actions

 * @note Авторизация требуется от аккаунта: @p coopname
 */
void capital::cancelproj(eosio::name coopname, checksum256 project_hash) {
  require_auth(coopname);

  auto project = Capital::Projects::get_project_or_fail(coopname, project_hash);

  eosio::check(project.status != Capital::Projects::Status::FINALIZED,
               "Финализированный проект отменить нельзя");

  eosio::check(!Capital::Projects::has_component_projects(coopname, project_hash),
               "Нельзя отменить проект: сначала отмените его компоненты");

  // Возвращаем неизрасходованные средства в программу до удаления записи.
  Capital::Core::return_unused_investments(coopname, project.id);

  // Сегменты участников уходят вместе с проектом — иначе они остались бы
  // в оперативной памяти цепи без проекта, к которому относятся.
  Capital::Segments::remove_all_project_segments(coopname, project_hash);

  Capital::Projects::delete_project(coopname, project.id);
}
