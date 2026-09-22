/**
 * @brief Создание запроса на вывод средств из фонда.
 * Создает запрос на вывод средств из фонда накопления или списания.
 * Запрос требует утверждения советом перед фактическим списанием средств.
 * @param coopname Наименование кооператива
 * @param username Имя пользователя, запрашивающего вывод
 * @param type Тип запроса (afund_withdraw - из фонда накопления, efund_withdraw - из фонда списания)
 * @param fund_id Идентификатор фонда
 * @param document Документ с обоснованием запроса
 * @param quantity Количество средств для вывода
 * @param bank_data_id Идентификатор банковских данных
 * @ingroup public_actions
 * @ingroup public_fund_actions

 * @note Авторизация требуется от аккаунта: @p contract (если фонд управляется внешним контрактом) или @p username (сотрудник с правами complete)
 */
/* Метод создания вывода средств из фонда накопления или по фонду списания
 * Использование метода не накладывает условие проверки на наличие средств в
 * целевом фонде. Проверка на наличие происходит в момент списания (complete)
 * после утверждения решения советом. Т.е. совет может принять решение о будущем
 * расходе, но фактическое списание осуществится только при наличии средств в
 * фондах.
 */
[[eosio::action]] void fund::fundwithdraw(eosio::name coopname,
                                          eosio::name username,
                                          eosio::name type, uint64_t fund_id,
                                          document2 document,
                                          eosio::asset quantity,
                                          std::string bank_data_id) {
  eosio::check(type == _afund_withdraw_action || type == _efund_withdraw_action,
               "Неверный тип фонда");
  eosio::name payer;

  if (type == _afund_withdraw_action) {
    accfunds_index accfunds(_fund, coopname.value);
    auto afund = accfunds.find(fund_id);
    eosio::check(afund != accfunds.end(), "Фонд не найден");
    payer = afund->contract != ""_n ? afund->contract : username;
  } else if (type == _efund_withdraw_action) {
    expfunds_index expfunds(_fund, coopname.value);
    auto efund = expfunds.find(fund_id);
    eosio::check(efund != expfunds.end(), "Фонд не найден");
    payer = efund->contract != ""_n ? efund->contract : username;
  }

  require_auth(payer);

  if (payer == username) {
    staff_index staff(_soviet, coopname.value);
    auto persona = staff.find(username.value);
    eosio::check(persona != staff.end(),
                 "Указанный аккаунт не является сотрудником");
    eosio::check(persona->has_right(_soviet, "complete"_n),
                 "Недостаточно прав доступа");
  };

  fundwithdraws_index fundwithdraws(_fund, coopname.value);
  uint64_t fundwithdraw_id = get_global_id(_fund, "fundwithdraw"_n);

  fundwithdraws.emplace(RamPayer::of(fundwithdraws, coopname), [&](auto &s) {
    s.id = fundwithdraw_id;
    s.type = type;
    s.status = "pending"_n;
    s.coopname = coopname;
    s.username = username;
    s.fund_id = fund_id;
    s.quantity = quantity;
    s.document = document;
    s.bank_data_id = bank_data_id;
  });

  action(permission_level{_fund, "active"_n}, _soviet, "fundwithdraw"_n,
         std::make_tuple(coopname, username, type, fundwithdraw_id, document))
      .send();

  // оповещаем себя же
  action(permission_level{_fund, "active"_n}, _fund, "newwithdraw"_n,
         std::make_tuple(coopname, type, fundwithdraw_id))
      .send();
}