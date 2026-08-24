/**
 * @brief Совет разрешил выдачу займа — платёж уходит на исполнение.
 *
 * Решение совета сохраняется в записи займа, займ переходит в ожидание платежа.
 * Дальше приходит подтверждение выдачи либо отказ по реквизитам — во втором
 * случае решение совета остаётся в силе и платёж можно отправить повторно.
 * @param coopname Наименование кооператива
 * @param debt_hash Хеш долга для авторизации
 * @param decision Документ решения совета
 * @ingroup public_actions
 * @ingroup public_capital_actions

 * @note Авторизация требуется от аккаунта: @p _soviet
 */
//действие вызывается советом как коллбэк при положительном решении по вопросу выдачи ссуд
//вызывает контракт шлюза для регистрации исходящего платежа
void capital::debtauthcnfr(eosio::name coopname, checksum256 debt_hash, document2 decision) {
    require_auth(_soviet);

    // Получаем долг
    auto exist_debt = Capital::Debts::get_debt_or_fail(coopname, debt_hash);
    
    // Фиксируем решение совета и ставим займ в ожидание платежа.
    Capital::Debts::start_pay(coopname, exist_debt.id, decision, _capital);

    
    // создаём объект исходящего платежа в gateway с коллбэком после обработки
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
};