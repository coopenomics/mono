/**
 * @brief Редактирует проект
 * Выполняет проверки и редактирует существующий проект в системе кооператива:
 * - Проверяет существование проекта с указанным хэшем
 * - Проверяет что проект не завершен
 * - Обновляет указанные поля проекта
 * @param coopname Имя кооператива (scope таблицы)
 * @param project_hash Уникальный хэш проекта для редактирования
 * @param title Новое название проекта
 * @param description Новое описание проекта
 * @param invite Новое приглашение к проекту
 * @param meta Новые метаданные проекта
 * @param data Новые данные/шаблон проекта
 * @ingroup public_actions
 * @ingroup public_capital_actions

 * @note Авторизация требуется от аккаунта: @p coopname
 */
void capital::editproj (
  eosio::name coopname,
  checksum256 project_hash,
  std::string title,
  std::string description,
  std::string invite,
  std::string meta,
  std::string data
) {
    require_auth(coopname);
  
    // Проверяем что проект существует
    auto exist = Capital::Projects::get_project_or_fail(coopname, project_hash);
      
    // Проверяем что проект не завершен
    eosio::check(exist.status != Capital::Projects::Status::RESULT,
                 "Нельзя редактировать завершенный проект");

    Capital::Projects::edit_project(coopname, exist.id, title, description, invite, meta, data);
}
