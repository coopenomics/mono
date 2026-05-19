/**
 * @brief Повторная отправка платежа по займу в gateway после предыдущего отказа.
 *
 * Допустимо только из AUTHORIZED с непустым last_pay_error (то есть после debtpaydcln).
 * Использует уже сохранённое решение совета — новой авторизации не требуется.
 * Переводит займ в PAY_PENDING, очищает last_pay_error и создаёт новый outpay.
 *
 * @param coopname  Кооператив
 * @param debt_hash Хеш займа для повторной отправки
 * @ingroup public_actions
 * @ingroup public_capital_actions
 *
 * @note Авторизация требуется от @p coopname (председатель/backend). Пайщик подпись не ставит.
 */
void capital::debtpayretry(eosio::name coopname, checksum256 debt_hash) {
  require_auth(coopname);

  auto exist_debt = Capital::Debts::get_debt_or_fail(coopname, debt_hash);
  eosio::check(exist_debt.status == Capital::Debts::Status::AUTHORIZED,
               "Повторная отправка платежа возможна только из статуса authorized");
  eosio::check(!exist_debt.last_pay_error.empty(),
               "Повторная отправка платежа возможна только после предыдущего отказа (debtpaydcln)");

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

  // event ridge: должник и председатель видят повторную отправку.
  require_recipient(exist_debt.username);
  require_recipient(coopname);
}
