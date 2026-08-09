/**
 * @brief Назначение/изменение веса участника в распределении членских
 * взносов кооперативного участка (requirement b6 «Экономика КУ»).
 *
 * Условия распределения задаются per (КУ, контракт-источник): сегодня
 * источник — «Стол заказов» (marketplace), той же методикой управляются
 * финансы КУ других потребительских программ. Доля участника = вес / Σ весов;
 * изменение состава перебалансирует доли автоматически на следующих
 * начислениях.
 *
 * Guards:
 *  - КУ существует; участник — председатель (trustee) или доверенный КУ.
 *  - weight > 0 (исключение из распределения — delweight).
 *
 * @note Авторизация требуется от аккаунта: @p coopname (назначение —
 * прерогатива председателя КУ, право проверяет бэкенд).
 *
 * @ingroup public_branch_actions
 */
[[eosio::action]] void branch::setweight(eosio::name coopname, eosio::name braname,
                                          eosio::name contract, eosio::name username,
                                          uint64_t weight) {
  check_auth_or_fail(_branch, coopname, coopname, "setweight"_n);

  eosio::check(weight > 0, "Вес должен быть больше нуля; для исключения из распределения используйте delweight");
  eosio::check(contract.value != 0, "Не указан контракт-источник распределения");

  auto branch = get_branch_or_fail(coopname, braname);
  eosio::check(branch.is_user_authorized(username),
               "Участник распределения должен быть председателем или доверенным кооперативного участка");

  branch_weights_index weights(_branch, coopname.value);
  auto idx = weights.get_index<"bycontrbra"_n>();

  // Один участник — одна запись в группе (braname, contract). Группа мала
  // (председатель + до 3 доверенных) — линейный проход по диапазону.
  int64_t total_delta = static_cast<int64_t>(weight);
  bool found = false;
  for (auto it = idx.lower_bound(combine_ids(contract.value, braname.value));
       it != idx.upper_bound(combine_ids(contract.value, braname.value)); ++it) {
    if (it->username != username) continue;
    total_delta -= static_cast<int64_t>(it->weight);
    idx.modify(it, coopname, [&](auto& w) { w.weight = weight; });
    found = true;
    break;
  }

  if (!found) {
    weights.emplace(coopname, [&](auto& w) {
      w.id       = weights.available_primary_key();
      w.braname  = braname;
      w.contract = contract;
      w.username = username;
      w.weight   = weight;
    });
  }

  apply_weight_total_delta(coopname, braname, contract, total_delta);
}
