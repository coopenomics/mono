/**
 * @brief Платёж по займу не прошёл по реквизитам.
 *
 * Решение совета уже принято, поэтому запись займа не удаляется и не
 * откатывается к одобрению председателя: займ возвращается в состояние
 * «разрешён советом», а причина отказа сохраняется. Отправить платёж повторно
 * можно тем же решением, не собирая совет заново.
 *
 * @param coopname   Наименование кооператива
 * @param debt_hash  Хеш займа, по которому пришёл отказ
 * @param reason     Причина отказа
 * @ingroup public_actions
 * @ingroup public_capital_actions
 *
 * @note Авторизация требуется от аккаунта: @p _gateway
 */
void capital::debtpaydcln(name coopname, checksum256 debt_hash, std::string reason) {
  require_auth(_gateway);

  auto exist_debt = Capital::Debts::get_debt_or_fail(coopname, debt_hash);

  Capital::Debts::mark_pay_declined(coopname, exist_debt.id, reason, _capital);

  // Пайщик и кооператив получают уведомление об отказе по реквизитам.
  require_recipient(exist_debt.username);
  require_recipient(coopname);
};
