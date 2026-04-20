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

  // Проверяем что долг в статусе 'authorized' (готов к выплате)
  eosio::check(exist_debt.status == Capital::Debts::Status::AUTHORIZED,
               "Долг должен быть в статусе 'authorized' для подтверждения оплаты");

  // Обновляем статус долга на PAID
  Capital::Debts::update_debt_status(coopname, exist_debt.id, Capital::Debts::Status::PAID, _gateway);

  // Выдача пайщику беспроцентного займа: Dr 58 / Cr 51, ISSUE LOAN_ISSUED (4051).
  // Семантика момента — деньги ушли пайщику, у кооператива появилось финансовое
  // вложение (58) против уменьшения расчётного (51). Возврат займа —
  // REPAY_LOAN при подписании акта-2 через результат (signact2.cpp).
  auto memo = Capital::Memo::get_debt_memo(exist_debt.username);
  Ledger2::apply(_capital, coopname, ledger2_ops::ISSUE_LOAN, exist_debt.amount, exist_debt.username, debt_hash, memo);

  // Увеличиваем долг contributor (теперь долг активен и должен быть погашен через внесение результата)
  Capital::Contributors::increase_debt_amount(coopname, contributor->id, exist_debt.amount);
  
};  