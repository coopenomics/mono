/**
 * @brief Миграция контракта capital — идемпотентное восстановление
 *        program_expense_pool / program_expense_reserved в capital::state.
 *
 * Контекст: CDT binary_extension::operator<< при пустом значении пишет T() =
 * asset() с пустым символом. После setconfig/update_global_state без явной
 * инициализации поля материализуются как «0 » (без RUB) и ломают topup/reserve
 * («attempt to add asset with different symbol»).
 *
 * Действие:
 *  - для каждой строки state: если оба поля уже с _root_govern_symbol — skip;
 *  - иначе переписать через ext_or_zero (absent / пустой символ при amount==0
 *    → 0.0000 RUB; ненулевая сумма с чужим символом — assert).
 *
 * Идемпотентно: повторный вызов после успешного прогона — no-op.
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
