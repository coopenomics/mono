/**
 * @brief Запускает проект на приём коммитов
 * Переводит проект в активный статус для приема коммитов:
 * - Проверяет существование проекта
 * - Валидирует что проект в статусе pending
 * - Требует назначенного мастера (без мастера коммиты некому одобрять)
 * - Для компонента: требует, чтобы родительский проект был в статусе active
 * - Обновляет статус проекта на active
 * @param coopname Наименование кооператива
 * @param project_hash Хеш проекта для запуска
 * @ingroup public_actions
 * @ingroup public_capital_actions

 * @note Авторизация требуется от аккаунта: @p coopname
 */
void capital::startproject(name coopname, checksum256 project_hash) {
    require_auth(coopname);

    // Проверяем существование проекта и получаем его
    auto project = Capital::Projects::get_project_or_fail(coopname, project_hash);

    // Проверяем что проект авторизован советом
    //eosio::check(project.is_authorized, "Проект не авторизован советом");

    // Проверяем, что проект в статусе "pending"
    eosio::check(project.status == Capital::Projects::Status::PENDING, "Проект должен быть в статусе 'pending'");

    // Без мастера коммиты некому одобрять — переход в active бессмыслен.
    eosio::check(project.master.value != 0, "Невозможно запустить проект без назначенного мастера. Назначьте мастера через setmaster.");

    // Если это компонент (есть parent_hash) — родитель должен быть активен.
    // Иначе компонент окажется в active под завершённым/отменённым/ещё не
    // запущенным проектом-родителем.
    checksum256 empty_hash = checksum256();
    if (project.parent_hash != empty_hash) {
        auto parent = Capital::Projects::get_project_or_fail(coopname, project.parent_hash);
        eosio::check(parent.status == Capital::Projects::Status::ACTIVE,
                     "Невозможно запустить компонент: родительский проект не в статусе 'active'");
    }

    // Обновляем статус проекта на "active"
    Capital::Projects::update_status(coopname, project.id, Capital::Projects::Status::ACTIVE);
}
