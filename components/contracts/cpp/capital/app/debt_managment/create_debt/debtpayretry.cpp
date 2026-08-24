/**
 * @brief Повторно отправляет платёж по займу после отказа по реквизитам.
 *
 * Решение совета уже принято и остаётся в силе — заново собирать совет
 * не требуется. Заём снова переходит в ожидание платежа, причина прошлого
 * отказа очищается.
 *
 * @param coopname  Наименование кооператива
 * @param debt_hash Хеш займа, платёж по которому отправляется повторно
 * @ingroup public_actions
 * @ingroup public_capital_actions
 *
 * @note Авторизация требуется от аккаунта: @p coopname. Пайщик подпись не ставит.
 */
void capital::debtpayretry(eosio::name coopname, checksum256 debt_hash) {
  require_auth(coopname);

  auto exist_debt = Capital::Debts::get_debt_or_fail(coopname, debt_hash);
  eosio::check(exist_debt.status == Capital::Debts::Status::AUTHORIZED,
               "Повторно отправить платёж можно по займу, разрешённому советом");
  eosio::check(!Capital::Debts::read_last_pay_error(exist_debt).empty(),
               "Повторная отправка возможна только после отказа по реквизитам");

  Capital::Debts::start_pay(coopname, exist_debt.id, exist_debt.authorization, _capital);

  ::Gateway::create_outcome(
    _capital,
    coopname,
    exist_debt.username,
    exist_debt.debt_hash,
    exist_debt.amount,
    _capital,
    Names::Capital::CONFIRM_DEBT_PAYMENT,
    Names::Capital::DECLINE_DEBT
  );

  // Пайщик и кооператив получают уведомление о повторной отправке платежа.
  require_recipient(exist_debt.username);
  require_recipient(coopname);
}
