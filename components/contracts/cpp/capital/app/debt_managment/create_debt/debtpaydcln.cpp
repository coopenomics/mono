/**
 * @brief Отклоняет оплату долга по реквизитам (gateway возвращает ошибку перечисления).
 *
 * Решение совета уже принято в @ref capital::debtauthcnfr, долг НЕ удаляется и НЕ откатывается
 * в approved. Запись остаётся, статус возвращается из @c pay_pending в @c authorized
 * с заполненным полем @c last_pay_error = @p reason. Из @c authorized доступна повторная
 * отправка в gateway без новой авторизации совета.
 *
 * @param coopname   Наименование кооператива
 * @param debt_hash  Хеш долга, для которого пришёл отказ от gateway
 * @param reason     Текстовая причина отказа (заполняется gateway-оператором)
 * @ingroup public_actions
 * @ingroup public_capital_actions
 *
 * @note Авторизация требуется от аккаунта: @p _gateway
 */
void capital::debtpaydcln(name coopname, checksum256 debt_hash, std::string reason) {
  require_auth(_gateway);

  auto exist_debt = Capital::Debts::get_debt_or_fail(coopname, debt_hash);

  Capital::Debts::mark_pay_declined(coopname, exist_debt.id, reason, _capital);
};
