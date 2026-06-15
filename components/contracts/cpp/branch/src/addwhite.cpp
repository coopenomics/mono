/**
 * @brief Добавление аккаунта в белый список кооперативного участка.
 * Аккаунты из белого списка могут выбрать приватный кооперативный участок при вступлении
 * или смене участка. Добавлять можно только физических лиц.
 * @param coopname Наименование кооператива
 * @param braname Наименование кооперативного участка
 * @param account Аккаунт пайщика для добавления (должен быть физическим лицом)
 * @ingroup public_actions
 * @ingroup public_branch_actions

 * @note Авторизация требуется от аккаунта: @p coopname
 */
[[eosio::action]] void branch::addwhite(eosio::name coopname, eosio::name braname, eosio::name account) {
    check_auth_or_fail(_branch, coopname, coopname, "addwhite"_n);

    branch_index branches(_branch, coopname.value);
    auto branch = branches.find(braname.value);
    eosio::check(branch != branches.end(), "Кооперативный участок не найден");

    auto account_obj = get_account_or_fail(account);
    eosio::check(account_obj.type == "individual"_n, "Только физическое лицо может быть добавлено в белый список кооперативного участка");

    branches.modify(branch, coopname, [&](auto &b) {
        b.add_account_to_whitelist(account);
    });
}
