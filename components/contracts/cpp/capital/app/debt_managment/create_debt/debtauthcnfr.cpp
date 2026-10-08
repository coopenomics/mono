/**
 * @brief Решение совета о предоставлении займа
 * Совет разрешил выдачу: решение сохраняется, договор уходит председателю на
 * подпись через запросы одобрений. Платёж кассиру создаётся после подписи
 * (debtsigned).
 * @param coopname Наименование кооператива
 * @param debt_hash Хэш займа
 * @param decision Решение совета
 * @ingroup public_actions
 * @ingroup public_capital_actions
 * @note Авторизация требуется от аккаунта: @p _soviet
 */
void capital::debtauthcnfr(eosio::name coopname, checksum256 debt_hash, document2 decision) {
    require_auth(_soviet);

    auto exist_debt = Capital::Debts::get_debt_or_fail(coopname, debt_hash);
    eosio::check(exist_debt.status == Capital::Debts::Status::PENDING, "Решение совета принимается по заявлению с договором");

    Capital::Debts::update_debt_status(coopname, exist_debt.id, Capital::Debts::Status::AUTHORIZED,
                                       _capital, decision);

    Capital::Debts::create_contract_approval(coopname, exist_debt.username, debt_hash, exist_debt.contract);
};
