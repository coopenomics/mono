/**
 * @brief Редактирование кооперативного участка.
 * Изменяет председателя существующего кооперативного участка.
 * @param coopname Наименование кооператива
 * @param braname Наименование кооперативного участка
 * @param trustee Новый председатель кооперативного участка (должен быть физическим лицом)
 * @ingroup public_actions
 * @ingroup public_branch_actions

 * @note Авторизация требуется от аккаунта: @p coopname
 */
[[eosio::action]] void branch::editbranch(eosio::name coopname, eosio::name braname, eosio::name trustee) {
    check_auth_or_fail(_branch, coopname, coopname, "editbranch"_n);

    
    branch_index branches(_branch, coopname.value);
    auto branch = branches.find(braname.value);
    eosio::check(branch != branches.end(), "Кооперативный участок не найден");
      
    auto authorizer_account = get_account_or_fail(trustee);
    eosio::check(authorizer_account.type == "individual"_n, "Только физическое лицо может быть назначено председателем кооперативного участка");

    eosio::name previous_trustee = branch->trustee;

    if (previous_trustee != trustee) {
      // председатель может возглавлять только один кооперативный участок
      // (на тестнете ограничение снято — см. ENFORCE_SINGLE_BRANCH_TRUSTEE)
      if (ENFORCE_SINGLE_BRANCH_TRUSTEE) {
        auto branches_by_trustee = branches.get_index<"bytrustee"_n>();
        eosio::check(branches_by_trustee.find(trustee.value) == branches_by_trustee.end(),
                     "Пайщик уже является председателем другого кооперативного участка");
      }
    }

    branches.modify(branch, coopname, [&](auto &b) {
        b.trustee = trustee;
    });

    if (previous_trustee != trustee) {
      // прежний председатель освобождается от привязки и выбирает участок заново заявлением
      action(
        permission_level{ _branch, "active"_n},
        _soviet,
        "setbranch"_n,
        std::make_tuple(coopname, previous_trustee, ""_n)
      ).send();

      // новый председатель привязывается к собственному участку
      action(
        permission_level{ _branch, "active"_n},
        _soviet,
        "setbranch"_n,
        std::make_tuple(coopname, trustee, braname)
      ).send();
    }
}