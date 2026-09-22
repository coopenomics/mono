/**
 * @brief Установка статуса кооператива.
 * Изменяет статус кооператива (active, blocked, pending)
 * @param coopname Наименование кооператива
 * @param administrator Имя администратора
 * @param status Новый статус кооператива
 * @ingroup public_actions
 * @ingroup public_registrator_actions

 * @note Авторизация требуется от аккаунта: @p provider или @p administrator
 */
[[eosio::action]] void registrator::stcoopstatus(eosio::name coopname, eosio::name administrator, eosio::name status) {
    check_auth_or_fail(_registrator, _provider, administrator, "stcoopstatus"_n); //ожидаем разрешений от оператора
    
    cooperatives2_index coops(_registrator, _registrator.value);
    
    auto coop = coops.find(coopname.value);
    
    eosio::check(status == "active"_n || status == "blocked"_n || status == "pending"_n, "Недоступный статус для кооператива");
    
    eosio::check(coop != coops.end(), "Кооператив не найден");
    
    if (status == "active"_n) {
      action(
        permission_level{ _registrator, "active"_n},
        _fund,
        "init"_n,
        std::make_tuple(coopname, coop -> initial)
      ).send();
      
      if (coop -> status.value() == "pending"_n) {
        checksum256 hash = eosio::sha256((char*)&coopname, sizeof(coopname));
        
        Action::send<newresolved_interface>(
          _soviet,
          "newresolved"_n,
          _registrator,
          _provider,
          coopname,
          "regcoop"_n,
          hash,
          coop -> document.value()
        );
      }
    }
    
    coops.modify(coop, RamPayer::of(coops, coopname), [&](auto &row){ //payer is coopname should be always
      row.status = status;
    });
}

