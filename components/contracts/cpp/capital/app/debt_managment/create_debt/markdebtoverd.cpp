/**
 * @brief Помечает просроченные займы статусом OVERDUE.
 *
 * Долг считается просроченным, когда current_time_point > debt.due_at
 * (поле due_at проставляется в debtpaycnfrm на 3 месяца от даты выплаты).
 * Из OVERDUE долг можно так же закрыть settledebt или signact2 как из PAID.
 *
 * Action рассчитан на запуск из backend через @Cron (см. Эпик 4) — раз в сутки.
 * Один вызов помечает не более 100 записей чтобы уложиться в 30-секундный
 * лимит транзакции EOSIO; backend повторяет до тех пор, пока action не
 * помечает 0 — это сигнал, что в текущем scope больше нечего переводить.
 *
 * @param coopname Кооператив (scope таблицы debts)
 * @ingroup public_actions
 * @ingroup public_capital_actions
 *
 * @note Авторизация требуется от аккаунта: @p coopname (председатель / системный).
 */
void capital::markdebtoverd(name coopname) {
  require_auth(coopname);

  constexpr uint32_t MAX_PER_BATCH = 100;
  Capital::Debts::sweep_overdue(coopname, MAX_PER_BATCH);
}
