/**
 * @brief Авторизует долг в проекте советом
 * Авторизует долг в проекте советом и создает исходящий платеж:
 * - Получает долг
 * - Обновляет статус долга на authorized
 * - Создает объект исходящего платежа в gateway с коллбэком
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

    // Фиксируем решение совета и переводим долг в pay_pending —
    // outpay уходит в gateway, дальше debtpaycnfrm (успех) или debtpaydcln (отказ).
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