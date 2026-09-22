/**
 * @brief Завершение запроса на вывод средств из фонда.
 * Подтверждает фактическое списание средств из фонда после авторизации советом.
 * Выполняет списание средств из фонда накопления или добавление в фонд списания.
 * @param coopname Наименование кооператива
 * @param username Имя пользователя, подтверждающего списание
 * @param withdraw_id Идентификатор запроса на вывод
 * @ingroup public_actions
 * @ingroup public_fund_actions

 * @note Авторизация требуется от аккаунта: @p username (сотрудник с правами complete)
 */
[[eosio::action]] void fund::complete(eosio::name coopname,
                                      eosio::name username,
                                      uint64_t withdraw_id) {
  require_auth(username); 
  // todo check rights for username
  
  staff_index staff(_soviet, coopname.value);
  auto persona = staff.find(username.value);

  eosio::check(persona != staff.end(),
               "Указанный аккаунт не является сотрудником");
  eosio::check(persona->has_right(_soviet, "complete"_n),
               "Недостаточно прав доступа");

  fundwithdraws_index fundwithdraws(_fund, coopname.value);
  auto withdraw = fundwithdraws.find(withdraw_id);
  eosio::check(withdraw != fundwithdraws.end(), "Вывод не найден");

  fundwithdraws.modify(withdraw, RamPayer::of(fundwithdraws, coopname), [&](auto &s) {
    s.status = "completed"_n;
    s.expired_at = eosio::time_point_sec(
        eosio::current_time_point().sec_since_epoch() + 30 * 86400);
  });

  if (withdraw->type == _afund_withdraw_action) {
    accfunds_index accfunds(_fund, coopname.value);
    auto afund = accfunds.find(withdraw->fund_id);
    eosio::check(afund != accfunds.end(), "Фонд не найден");

    action(permission_level{_fund, "active"_n}, _fund, "subaccum"_n,
           std::make_tuple(coopname, withdraw->fund_id, withdraw->quantity))
        .send();
  } else if (withdraw->type == _efund_withdraw_action) {
    expfunds_index expfunds(_fund, coopname.value);
    auto efund = expfunds.find(withdraw->fund_id);
    eosio::check(efund != expfunds.end(), "Фонд не найден");

    action(permission_level{_fund, "active"_n}, _fund, "addexpense"_n,
           std::make_tuple(coopname, withdraw->fund_id, withdraw->quantity))
        .send();
  }
};