/**
 * @brief Добавление пайщика в белый список кооперативного участка.
 * Пайщики из белого списка могут выбрать приватный кооперативный участок при вступлении
 * или смене участка. В белый список можно добавить любого пайщика кооператива.
 * @param coopname Наименование кооператива
 * @param braname Наименование кооперативного участка
 * @param account Аккаунт пайщика для добавления
 * @ingroup public_actions
 * @ingroup public_branch_actions

 * @note Авторизация требуется от аккаунта: @p coopname
 */
[[eosio::action]] void branch::addwhite(eosio::name coopname, eosio::name braname, eosio::name account) {
    check_auth_or_fail(_branch, coopname, coopname, "addwhite"_n);

    branch_index branches(_branch, coopname.value);
    auto branch = branches.find(braname.value);
    eosio::check(branch != branches.end(), "Кооперативный участок не найден");

    get_account_or_fail(account);

    branches.modify(branch, coopname, [&](auto &b) {
        b.add_account_to_whitelist(account);
    });
}
