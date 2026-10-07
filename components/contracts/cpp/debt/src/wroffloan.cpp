/**
 * @brief Приложение закрыло свой заём без денег.
 *
 * Обеспечение обращено приложением; в реестре заём закрывается, общий долг
 * пайщика уменьшается на остаток.
 *
 * @ingroup public_actions
 * @ingroup public_debt_actions

 * @note Авторизация требуется от контракта-источника записи
 */
void debt::wroffloan(WROFFLOAN_SIGNATURE) {
  name source = check_auth_and_get_payer_or_fail(contracts_whitelist);

  auto d = Debt::Core::get_debt_or_fail(coopname, debt_hash);
  eosio::check(d.source == source, "Закрытие сообщает приложение, которое выдало заём");

  Debt::Core::change_summary(coopname, d.username, -d.remaining);
  Debt::Core::erase_debt(coopname, d.id);

  require_recipient(d.username);
  require_recipient(coopname);
}
