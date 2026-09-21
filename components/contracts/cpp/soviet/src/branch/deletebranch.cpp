/**
 * @brief Удаление кооперативного участка
 * Отключает всех участников от удаляемого кооперативного участка.
 * Сбрасывает привязку участников к филиалу при его удалении.
 * @param coopname Наименование кооператива
 * @param braname Наименование кооперативного участка
 * @ingroup public_actions
 * @ingroup public_soviet_actions

 * @note Авторизация требуется от аккаунта: @p _branch
 */
void soviet::deletebranch(eosio::name coopname, eosio::name braname) {
    require_auth(_branch);

    participants_index participants(_soviet, coopname.value);
    auto idx = participants.get_index<"bybranch"_n>();

    for (auto itr = idx.lower_bound(braname.value); itr != idx.end() && itr->by_braname() == braname.value; ++itr) {
        if (itr->braname.has_value() && itr->braname.value() == braname) {
            idx.modify(itr, RamPayer::of(idx, coopname), [&](auto& row) {
                row.braname.reset();
            });
        }
    }
}