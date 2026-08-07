/**
 * @brief Миграция контракта capital — восстановление хвостового
 *        binary_extension поля total_debt_amount в capital::projects.
 *
 * Контекст: контракт стоит на проде, строки projects записаны до появления
 * поля и отдают absent. Значение производно от segments, восстановить его
 * можно только суммированием debt_amount по сегментам проекта — что и делает
 * sync_total_debt.
 *
 * Действие: для каждого проекта каждого кооператива пересчитать
 * total_debt_amount обходом сегментов (индекс byproject) и материализовать поле.
 *
 * Идемпотентно: повторный вызов после успешного прогона — no-op (sync_total_debt
 * пишет в таблицу только при расхождении).
 * Вызывается автоматически при деплое (playbooks/contracts/deploy-contract.yml).
 *
 * Прежняя миграция (program_expense_pool / program_expense_reserved в
 * capital::state) проведена на всех окружениях и удалена: действие миграции
 * несёт только незакрытый переход, иначе оно копит уже отработавший код.
 *
 * @ingroup public_actions
 * @ingroup public_capital_actions
 *
 * @note Авторизация требуется от аккаунта: @p _capital
 */
void capital::migrate() {
  require_auth(_capital);

  // Список кооперативов берём из state — там по строке на кооператив,
  // а projects лежат в scope = coopname.
  Capital::global_state_table global_state_inst(_capital, _capital.value);

  for (auto state_itr = global_state_inst.begin(); state_itr != global_state_inst.end(); ++state_itr) {
    Capital::project_index projects(_capital, state_itr->coopname.value);

    for (auto project_itr = projects.begin(); project_itr != projects.end(); ++project_itr) {
      Capital::Projects::sync_total_debt(state_itr->coopname, project_itr->id);
    }
  }
}
