/**
 * @brief Отклоняет долг в проекте
 * Отклоняет долг в проекте и восстанавливает доступные средства:
 * - Получает долг и участника
 * - Проверяет существование сегмента
 * - Уменьшает debt_amount в сегменте
 * - Удаляет долг из базы данных
 * @param coopname Наименование кооператива
 * @param username Наименование пользователя, отклонившего долг
 * @param debt_hash Хеш долга для отклонения
 * @param reason Причина отклонения долга
 * @ingroup public_actions
 * @ingroup public_capital_actions

 * @note Авторизация требуется от контракта совета
 */
void capital::declinedebt(name coopname, eosio::name username, checksum256 debt_hash, std::string reason) {
  //вызывается при отклонении советом или председателем из контракта совета
  name payer = check_auth_and_get_payer_or_fail({_gateway, _soviet});

  // Получаем долг
  auto exist_debt = Capital::Debts::get_debt_or_fail(coopname, debt_hash);

  // Получаем участника
  auto exist_contributor = Capital::Contributors::get_active_contributor_with_appendix_or_fail(coopname, exist_debt.project_hash, exist_debt.username);
  eosio::check(exist_contributor.has_value(), "Договор УХД с пайщиком не найден");
  
  auto project = Capital::Projects::get_project_or_fail(coopname, exist_debt.project_hash);
  
  // Уменьшаем debt_amount в сегменте
  auto exist_segment = Capital::Segments::get_segment(coopname, exist_debt.project_hash, exist_debt.username);
  eosio::check(exist_segment.has_value(), "Сегмент не найден");
  
  // Уменьшаем debt_amount в сегменте
  Capital::Segments::decrease_debt_amount(coopname, exist_segment->id, exist_debt.amount);
  
  // Удаляем долг
  Capital::Debts::delete_debt(coopname, exist_debt.id);
  
  // Уменьшаем сумму использованных для компенсации инвестиций
  Capital::Projects::subtract_used_for_compensation(coopname, project.id, exist_debt.amount);

  // Держим агрегат ссуд проекта в актуальном состоянии — от него зависит
  // граница деаллокации (calculate_max_deallocatable)
  Capital::Projects::sync_total_debt(coopname, project.id);
}