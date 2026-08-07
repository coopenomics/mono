/**
 * @brief Миграция контракта capital — идемпотентное восстановление хвостовых
 *        binary_extension полей: program_expense_pool / program_expense_reserved
 *        в capital::state и total_debt_amount в capital::projects.
 *
 * Контекст: CDT binary_extension::operator<< при пустом значении пишет T() =
 * asset() с пустым символом. После setconfig/update_global_state без явной
 * инициализации поля материализуются как «0 » (без RUB) и ломают topup/reserve
 * («attempt to add asset with different symbol»).
 *
 * Действие:
 *  - для каждой строки state: если оба поля уже с _root_govern_symbol — skip;
 *  - иначе переписать через ext_or_zero (absent / пустой символ при amount==0
 *    → 0.0000 RUB; ненулевая сумма с чужим символом — assert);
 *  - для каждого проекта каждого кооператива: пересчитать total_debt_amount
 *    обходом сегментов проекта (индекс byproject) и материализовать поле.
 *
 * Почему проекты обходим здесь: контракт стоит на проде, строки projects
 * записаны до появления total_debt_amount и отдают absent. Значение
 * производно от segments, восстановить его можно только суммированием
 * debt_amount по сегментам — что и делает sync_total_debt.
 *
 * Идемпотентно: повторный вызов после успешного прогона — no-op (sync_total_debt
 * пишет в таблицу только при расхождении).
 * Вызывается автоматически при деплое (playbooks/contracts/deploy-contract.yml).
 *
 * @ingroup public_actions
 * @ingroup public_capital_actions
 *
 * @note Авторизация требуется от аккаунта: @p _capital
 */
void capital::migrate() {
  require_auth(_capital);

  Capital::global_state_table global_state_inst(_capital, _capital.value);

  // Проекты: восстанавливаем total_debt_amount по сегментам.
  // Список кооперативов берём из state — там по строке на кооператив,
  // а projects лежат в scope = coopname.
  for (auto state_itr = global_state_inst.begin(); state_itr != global_state_inst.end(); ++state_itr) {
    Capital::project_index projects(_capital, state_itr->coopname.value);

    for (auto project_itr = projects.begin(); project_itr != projects.end(); ++project_itr) {
      Capital::Projects::sync_total_debt(state_itr->coopname, project_itr->id);
    }
  }

  for (auto itr = global_state_inst.begin(); itr != global_state_inst.end(); ++itr) {
    const bool pool_ok =
        itr->program_expense_pool.has_value() &&
        itr->program_expense_pool.value().symbol == _root_govern_symbol;
    const bool reserved_ok =
        itr->program_expense_reserved.has_value() &&
        itr->program_expense_reserved.value().symbol == _root_govern_symbol;

    if (pool_ok && reserved_ok) {
      continue;
    }

    global_state_inst.modify(itr, _capital, [&](auto &s) {
      s.program_expense_pool =
          Capital::State::ext_or_zero(s.program_expense_pool, _root_govern_symbol);
      s.program_expense_reserved =
          Capital::State::ext_or_zero(s.program_expense_reserved, _root_govern_symbol);
    });
  }
}
