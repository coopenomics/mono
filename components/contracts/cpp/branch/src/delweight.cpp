/**
 * @brief Исключение участника из распределения членских взносов КУ
 * (requirement b6 «Экономика КУ»).
 *
 * Запись веса удаляется, Σ весов уменьшается — доли оставшихся участников
 * перебалансируются автоматически на следующих начислениях. Ничего не
 * блокируется и не переносится в общий кошелёк (решение владельца
 * 2026-06-10). Уже распределённые средства остаются на персональном
 * кошельке участника.
 *
 * @note Авторизация требуется от аккаунта: @p coopname.
 *
 * @ingroup public_branch_actions
 */
[[eosio::action]] void branch::delweight(eosio::name coopname, eosio::name braname,
                                          eosio::name contract, eosio::name username) {
  check_auth_or_fail(_branch, coopname, coopname, "delweight"_n);

  get_branch_or_fail(coopname, braname);

  branch_weights_index weights(_branch, coopname.value);
  auto idx = weights.get_index<"bycontrbra"_n>();

  for (auto it = idx.lower_bound(combine_ids(contract.value, braname.value));
       it != idx.upper_bound(combine_ids(contract.value, braname.value)); ++it) {
    if (it->username != username) continue;
    const int64_t delta = -static_cast<int64_t>(it->weight);
    idx.erase(it);
    apply_weight_total_delta(coopname, braname, contract, delta);
    return;
  }

  eosio::check(false, "Участник не найден в распределении членских взносов этого кооперативного участка");
}
