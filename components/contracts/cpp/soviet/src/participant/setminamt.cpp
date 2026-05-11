/**
 * @brief Корректировка minimum_amount у уже принятого пайщика.
 * Технический фикс для случаев, когда поле рассинхронизировано с кооп-параметром
 * (например, у voskhod::ant исторически осталось 1 RUB вместо 300 RUB).
 * @param coopname Наименование кооператива
 * @param username Наименование пайщика
 * @param minimum Новая сумма minimum_amount
 * @ingroup public_actions
 * @ingroup public_soviet_actions

 * @note Авторизация требуется от аккаунта @p coopname
 */
void soviet::setminamt(eosio::name coopname, eosio::name username, eosio::asset minimum) {
  require_auth(coopname);

  auto cooperative = get_cooperative_or_fail(coopname);
  cooperative.check_symbol_or_fail(minimum);
  eosio::check(minimum.amount > 0, "minimum_amount должен быть положительным");

  participants_index participants(_soviet, coopname.value);
  auto p = participants.find(username.value);
  eosio::check(p != participants.end(), "Пайщик не найден");

  participants.modify(p, coopname, [&](auto &m){
    m.minimum_amount = minimum;
  });
}
