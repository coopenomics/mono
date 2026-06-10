/**
 * @brief Удаление доверенного лица из кооперативного участка.
 * Удаляет доверенное лицо из существующего кооперативного участка.
 * @param coopname Наименование кооператива
 * @param braname Наименование кооперативного участка
 * @param trusted Доверенное лицо для удаления
 * @ingroup public_actions
 * @ingroup public_branch_actions

 * @note Авторизация требуется от аккаунта: @p coopname
 */
[[eosio::action]] void branch::deltrusted(eosio::name coopname, eosio::name braname, eosio::name trusted) {
    check_auth_or_fail(_branch, coopname, coopname, "deltrusted"_n);

    branch_index branches(_branch, coopname.value);
    auto branch = branches.find(braname.value);
    eosio::check(branch != branches.end(), "Кооперативный участок не найден");
    
    branches.modify(branch, coopname, [&](auto &b) {
        auto it = std::find(b.trusted.begin(), b.trusted.end(), trusted);
        eosio::check(it != b.trusted.end(), "Доверенный не найден в кооперативном участке");
        b.trusted.erase(it);
    });

    // Экономика КУ (requirement b6): удалённый доверенный выбывает из
    // распределения членских взносов по всем контрактам-источникам — его
    // веса удаляются, Σ весов уменьшается, доли оставшихся перебалансируются
    // автоматически на следующих начислениях. Уже распределённые средства
    // остаются на его персональном кошельке (w.brn.person).
    branch_weights_index weights(_branch, coopname.value);
    auto bybranch = weights.get_index<"bybranch"_n>();
    auto wit = bybranch.lower_bound(braname.value);
    while (wit != bybranch.end() && wit->braname == braname) {
        if (wit->username != trusted) { ++wit; continue; }
        const eosio::name w_contract = wit->contract;
        const int64_t delta = -static_cast<int64_t>(wit->weight);
        wit = bybranch.erase(wit);
        apply_weight_total_delta(coopname, braname, w_contract, delta);
    }
}
