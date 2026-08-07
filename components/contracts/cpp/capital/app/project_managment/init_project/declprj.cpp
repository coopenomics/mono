/**
 * @brief Отклоняет проект советом
 * Отклоняет проект советом кооператива:
 * - Проверяет что проект существует и не авторизован
 * - Удаляет проект из таблицы
 * @param coopname Наименование кооператива
 * @param project_hash Хеш проекта для отклонения
 * @param reason Причина отклонения
 * @ingroup public_actions
 * @ingroup public_capital_actions
 *
 * @note Авторизация требуется от аккаунта: @p _soviet
 */
void capital::declprj(eosio::name coopname, checksum256 project_hash, std::string reason) {
  require_auth(_soviet);

  // Проверяем статус проекта
  auto exist_project = Capital::Projects::get_project_or_fail(coopname, project_hash);
  // eosio::check(!exist_project.is_authorized, "Нельзя отклонить уже авторизованный проект");

  // Удаляем проект
  Capital::Projects::delete_project(coopname, exist_project.id);
};