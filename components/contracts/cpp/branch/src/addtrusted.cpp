/**
 * @brief Добавление доверенного лица в кооперативный участок.
 * Добавляет нового доверенного лица в существующий кооперативный участок.
 * Максимальное количество доверенных лиц на один участок - 3.
 * @param coopname Наименование кооператива
 * @param braname Наименование кооперативного участка
 * @param trusted Доверенное лицо для добавления (должно быть физическим лицом)
 * @ingroup public_actions
 * @ingroup public_branch_actions

 * @note Авторизация требуется от аккаунта: @p coopname
 */
[[eosio::action]] void branch::addtrusted(eosio::name coopname, eosio::name braname, eosio::name trusted) {
    check_auth_or_fail(_branch, coopname, coopname, "addtrusted"_n);

    branch_index branches(_branch, coopname.value);
    auto branch = branches.find(braname.value);
    eosio::check(branch != branches.end(), "Кооперативный участок не найден");
    
    auto trusted_account = get_account_or_fail(trusted);
    eosio::check(trusted_account.type == "individual"_n, "Только физическое лицо может быть назначено доверенным кооперативного участка");

    branches.modify(branch, coopname, [&](auto &b) {
        eosio::check(b.trustee != trusted,
            "Председатель кооперативного участка не может быть добавлен доверенным лицом");
        eosio::check(std::find(b.trusted.begin(), b.trusted.end(), trusted) == b.trusted.end(),
            "Доверенный уже добавлен в кооперативный участок");
        eosio::check(b.trusted.size() < 3, "Не больше трех доверенных на одном кооперативном участке");
        b.trusted.push_back(trusted);
    });
}
