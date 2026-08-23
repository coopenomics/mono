/**
 * @brief Установка признака приватности кооперативного участка.
 * Приватный кооперативный участок нельзя выбрать при вступлении или смене участка,
 * если аккаунт пайщика не добавлен в белый список этого участка.
 * @param coopname Наименование кооператива
 * @param braname Наименование кооперативного участка
 * @param is_private Признак приватности (true — приватный, false — публичный)
 * @ingroup public_actions
 * @ingroup public_branch_actions

 * @note Авторизация требуется от аккаунта: @p coopname
 */
[[eosio::action]] void branch::setprivate(eosio::name coopname, eosio::name braname, bool is_private) {
    check_auth_or_fail(_branch, coopname, coopname, "setprivate"_n);

    branch_index branches(_branch, coopname.value);
    auto branch = branches.find(braname.value);
    eosio::check(branch != branches.end(), "Кооперативный участок не найден");

    branches.modify(branch, coopname, [&](auto &b) {
        b.set_private(is_private);
    });
}
