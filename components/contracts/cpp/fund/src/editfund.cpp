

[[eosio::action]] void fund::editfund(eosio::name coopname,
                                      eosio::name username, eosio::name type,
                                      uint64_t fund_id, eosio::name contract,
                                      std::string name, std::string description,
                                      uint64_t percent) {
  require_auth(username);

  eosio::check(type == "accumulation"_n || type == "expend"_n,
               "Неверный тип фонда");

  auto cooperative = get_cooperative_or_fail(coopname);

  auto soviet = get_board_by_type_or_fail(coopname, "soviet"_n);
  auto chairman = soviet.get_chairman();
  eosio::check(username == chairman,
               "Только председатель может управлять фондами");

  
  if (fund_id <= 5){
    /**
    Фонд развития кооперации (3) и резервный фонд (2) проценты менять можно.
    Названия фондов менять нельзя (id < 5).
    */
    
    eosio::check(fund_id != 0, "Неделимый фонд не может быть отредактирован");
  
  }


  if (type == "accumulation"_n) {
    accfunds_index accfunds(_fund, coopname.value);
    auto afund = accfunds.find(fund_id);
    eosio::check(afund != accfunds.end(), "Фонд не найден");
    
    if (fund_id <= 3){
      eosio::check(fund_id == 1, "Нельзя изменить процент неделимого фонда накопления");
      eosio::check(name == afund -> name, "Нельзя изменить имя обязательного фонда накопления");  
      eosio::check(contract == ""_n, "Нельзя передать в управление обязательный фонд");
    }
    
    eosio::check(
        percent > 0 && percent <= HUNDR_PERCENTS,
        "Процент фонда накопления должен быть больше нуля и меньше 100%");
    uint64_t total_percent = 0;

    // получаем сумму процентов всех фондов
    for (auto it = accfunds.begin(); it != accfunds.end(); it++) {
      total_percent += it->percent;
    }

    // вычитаем старый процент и добавляем новый
    total_percent += percent - afund->percent;

    // сумма процентов не должна превышать 100%
    check(total_percent <= HUNDR_PERCENTS,
          "Сумма всех процентов превышает 100%");

    accfunds.modify(afund, RamPayer::of(accfunds, coopname), [&](auto &a) {
      a.contract = contract;
      a.name = name;
      a.description = description;
      a.percent = percent;
    });
  } else if (type == "expend"_n) {
    eosio::check(
        percent == 0,
        "Процент для фонда списания должен быть равен нулю (не используется)");

    expfunds_index expfunds(_fund, coopname.value);
    auto efund = expfunds.find(fund_id);
    eosio::check(efund != expfunds.end(), "Фонд не найден");
  
    if (fund_id <= 5){
      eosio::check(name == efund -> name, "Нельзя изменить имя обязательного фонда списания");  
      eosio::check(contract == ""_n, "Нельзя передать в управление обязательный фонд");
    }

    expfunds.modify(efund, RamPayer::of(expfunds, coopname), [&](auto &e) {
      e.contract = contract;
      e.name = name;
      e.description = description;
    });
  };
};
