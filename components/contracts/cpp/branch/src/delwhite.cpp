/**
 * @brief Удаление аккаунта из белого списка кооперативного участка.
 * Удаляет аккаунт пайщика из белого списка приватного кооперативного участка.
 * @param coopname Наименование кооператива
 * @param braname Наименование кооперативного участка
 * @param account Аккаунт пайщика для удаления
 * @ingroup public_actions
 * @ingroup public_branch_actions

 * @note Авторизация требуется от аккаунта: @p coopname
 */
[[eosio::action]] void branch::delwhite(eosio::name coopname, eosio::name braname, eosio::name account) {
    check_auth_or_fail(_branch, coopname, coopname, "delwhite"_n);

    branch_index branches(_branch, coopname.value);
    auto branch = branches.find(braname.value);
    eosio::check(branch != branches.end(), "Кооперативный участок не найден");

    branches.modify(branch, coopname, [&](auto &b) {
        b.remove_account_from_whitelist(account);
    });
}
