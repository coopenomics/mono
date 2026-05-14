/**
 * @brief Добавляет участника в проект через CRPS систему
 * Добавляет участника в проект через систему CRPS с автоматическими проверками:
 * - Проверяет существование проекта (статус только pending или active)
 * - Контрибьютор в статусе active или import (приложение к проекту не требуется)
 * - Создаёт или обновляет долю участника (повторный вызов обновляет user_shares)
 * @param coopname Наименование кооператива
 * @param project_hash Хеш проекта
 * @param username Наименование пользователя-участника
 * @param user_shares Баланс пользователя в целевой потребительской программе
 * @ingroup public_actions
 * @ingroup public_capital_actions

 * @note Авторизация требуется от аккаунта кооператива: @p coopname (@c active)
 */
void capital::regshare(eosio::name coopname, checksum256 project_hash, eosio::name username, eosio::asset user_shares) {
  // Прямой вызов от кооператива (планировщик контроллера) ИЛИ inline-вызов
  // от системного контракта (например, capital::apprvappndx — авторегистрация
  // доли при допуске участника к проекту).
  if (!has_auth(coopname)) {
    check_auth_and_get_payer_or_fail(contracts_whitelist);
  }
  
  // Проверяем существование проекта
  auto project = Capital::Projects::get_project_or_fail(coopname, project_hash);
  eosio::check(
    project.status == Capital::Projects::Status::PENDING || project.status == Capital::Projects::Status::ACTIVE,
    "Регистрация доли возможна только для проекта в статусе pending или active");

  Capital::Contributors::get_contributor_for_regshare_or_fail(coopname, username);

  // Проверяем наличие сегмента
  auto exist_segment = Capital::Segments::get_segment(coopname, project_hash, username);
  
  uint64_t segment_id = 0;
  if (exist_segment.has_value()) {
    segment_id = exist_segment.value().id;
  } else {
    segment_id = Capital::Segments::get_segment_id(coopname);
  }
  
  // Добавляем участника
  Capital::Core::upsert_contributor_segment(coopname, segment_id, project, username, user_shares);
} 