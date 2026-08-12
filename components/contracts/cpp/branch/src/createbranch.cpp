/**
 * @brief Создание нового кооперативного участка.
 * Создает новый кооперативный участок с указанным председателем.
 * При создании третьего участка автоматически активирует систему кооперативных участков.
 * @param coopname Наименование кооператива
 * @param braname Наименование кооперативного участка
 * @param trustee Председатель кооперативного участка (должен быть физическим лицом)
 * @ingroup public_actions
 * @ingroup public_branch_actions

 * @note Авторизация требуется от аккаунта: @p coopname
 */
[[eosio::action]] void branch::createbranch(eosio::name coopname, eosio::name braname, eosio::name trustee) {
    check_auth_or_fail(_branch, coopname, coopname, "createbranch"_n);

    
    branch_index branches(_branch, coopname.value);
    auto coop = get_cooperative_or_fail(coopname);

    auto authorizer_account = get_account_or_fail(trustee);
    eosio::check(authorizer_account.type == "individual"_n, "Только физическое лицо может быть назначено председателем кооперативного участка");

    // председатель может возглавлять только один кооперативный участок
    // (на тестнете ограничение снято — см. ENFORCE_SINGLE_BRANCH_TRUSTEE)
    if (ENFORCE_SINGLE_BRANCH_TRUSTEE) {
      auto branches_by_trustee = branches.get_index<"bytrustee"_n>();
      eosio::check(branches_by_trustee.find(trustee.value) == branches_by_trustee.end(),
                   "Пайщик уже является председателем другого кооперативного участка");
    }

    branches.emplace(coopname, [&](auto &row) {
      row.braname = braname;
      row.trustee = trustee;
    });

    action(
      permission_level{ _branch, "active"_n},
      _registrator,
      "createbranch"_n,
      std::make_tuple(coopname, braname)
    ).send();

    // председатель привязывается к собственному участку и не выбирает его заявлением
    action(
      permission_level{ _branch, "active"_n},
      _soviet,
      "setbranch"_n,
      std::make_tuple(coopname, trustee, braname)
    ).send();

    uint64_t branch_count = add_branch_count(coopname);
    
    if (!coop.is_branched && branch_count >= 3) { //регистрируем переход на кооперативные участки
      action(
        permission_level{ _branch, "active"_n},
        _registrator,
        "enabranches"_n,
        std::make_tuple(coopname)
      ).send();
    }
    
    //TODO create subfunds and subwallets
    
}