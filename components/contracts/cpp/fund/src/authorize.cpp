/**
 * @brief Авторизация запроса на вывод средств из фонда.
 * Утверждает запрос на вывод средств советом кооператива.
 * @param coopname Наименование кооператива
 * @param type Тип запроса
 * @param withdraw_id Идентификатор запроса на вывод
 * @ingroup public_actions
 * @ingroup public_fund_actions

 * @note Авторизация требуется от аккаунта: @p _soviet
 */
[[eosio::action]] void fund::authorize(eosio::name coopname, eosio::name type,
                                       uint64_t withdraw_id) {
  require_auth(_soviet);

  fundwithdraws_index fundwithdraws(_fund, coopname.value);
  auto withdraw = fundwithdraws.find(withdraw_id);
  eosio::check(withdraw != fundwithdraws.end(), "Вывод не найден");

  fundwithdraws.modify(withdraw, RamPayer::of(fundwithdraws, coopname),
                       [&](auto &s) { s.status = "authorized"_n; });
};
