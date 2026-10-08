/**
 * @brief Кассир отклонил платёж по займу
 * Платёж не прошёл по реквизитам: решение совета и подписанный договор
 * остаются в силе, причина сохраняется, заём ждёт повтора платежа (debtretry).
 * @param coopname Наименование кооператива
 * @param debt_hash Хэш займа
 * @param reason Причина отказа
 * @ingroup public_actions
 * @ingroup public_capital_actions
 * @note Авторизация требуется от аккаунта: @p _gateway
 */
void capital::debtpaydcln(name coopname, checksum256 debt_hash, std::string reason) {
  require_auth(_gateway);

  auto exist_debt = Capital::Debts::get_debt_or_fail(coopname, debt_hash);
  eosio::check(exist_debt.status == Capital::Debts::Status::PAYING, "Отклоняется платёж займа, переданного на выплату");

  Capital::Debts::update_debt_status(coopname, exist_debt.id, Capital::Debts::Status::SIGNED, _gateway, document2{}, reason);
};
