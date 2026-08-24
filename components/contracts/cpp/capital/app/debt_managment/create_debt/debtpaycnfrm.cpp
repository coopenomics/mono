/**
 * @brief Подтверждает оплату выданной ссуды.
 * Подтверждает оплату выданной ссуды и переводит долг в статус PAID:
 * @param coopname Наименование кооператива
 * @param debt_hash Хеш-идентификатор ссуды для подтверждения оплаты
 * @ingroup public_actions
 * @ingroup public_capital_actions

 * @note Авторизация требуется от аккаунта: @p _gateway
 */
void capital::debtpaycnfrm(name coopname, checksum256 debt_hash) {
  require_auth(_gateway);

  // Получаем долг
  auto exist_debt = Capital::Debts::get_debt_or_fail(coopname, debt_hash);

  // Получаем контрибьютора
  auto contributor = Capital::Contributors::get_contributor(coopname, exist_debt.username);
  eosio::check(contributor.has_value(), "Контрибьютор не найден");

  // Отмечаем заём выданным и назначаем срок возврата — год со дня выдачи.
  // Проверка состояния и сброс причины прошлого отказа — внутри confirm_paid.
  Capital::Debts::confirm_paid(coopname, exist_debt.id, _gateway);

  // Выдача пайщику беспроцентного займа: Dr 58 / Cr 51, ISSUE LOAN_ISSUED (4051).
  // Семантика момента — деньги ушли пайщику, у кооператива появилось финансовое
  // вложение (58) против уменьшения расчётного (51). Возврат займа —
  // operations::capital::REPAY при подписании акта-2 через результат (signact2.cpp).
  auto memo = Capital::Memo::get_debt_memo(exist_debt.username);
  Ledger2::apply(_capital, coopname, operations::capital::LEND, processes::capital::DEBT, exist_debt.amount, exist_debt.username, debt_hash, memo);

  // Увеличиваем долг contributor (теперь долг активен и должен быть погашен через внесение результата)
  Capital::Contributors::increase_debt_amount(coopname, contributor->id, exist_debt.amount);

  // Отмечаем незакрытый заём на доле пайщика: при сдаче результата это избавляет
  // от перебора всех займов проекта.
  Capital::Segments::increase_active_debts_count(coopname, exist_debt.project_hash, exist_debt.username);

  // Сводный учёт займов ведёт отдельный контракт: он знает пайщика, сумму и срок,
  // а привязка займа к проекту остаётся здесь.
  auto fresh_debt = Capital::Debts::get_debt_or_fail(coopname, debt_hash);
  Loan::create_debt(_capital, coopname, exist_debt.username,
                    debt_hash, Capital::Debts::read_due_at(fresh_debt), exist_debt.amount);

  // Пайщик и кооператив получают уведомление о выдаче займа.
  require_recipient(exist_debt.username);
  require_recipient(coopname);
};
