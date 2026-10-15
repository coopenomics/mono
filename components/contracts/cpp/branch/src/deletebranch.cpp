/**
 * @brief Удаление кооперативного участка.
 * Удаляет существующий кооперативный участок и отключает его участников.
 * При удалении участка, когда остается менее 3 участков, автоматически отключает систему кооперативных участков.
 * @param coopname Наименование кооператива
 * @param braname Наименование кооперативного участка для удаления
 * @ingroup public_actions
 * @ingroup public_branch_actions

 * @note Авторизация требуется от аккаунта: @p coopname
 */
[[eosio::action]] void branch::deletebranch(eosio::name coopname, eosio::name braname) {
  check_auth_or_fail(_branch, coopname, coopname, "deletebranch"_n);

  branch_index branches(_branch, coopname.value);
  auto branch = branches.find(braname.value);
  auto coop = get_cooperative_or_fail(coopname);

  eosio::check(branch != branches.end(), "Кооперативный участок не найден");

  // Участок нельзя удалить, пока на нём держатся программы или в его общем
  // кошельке остаток: заказы упёрлись бы в «участок не найден», остаток
  // осиротел бы (задача 99D-16). Что именно проверяется — в shared-слое.
  Branch::check_can_delete(coopname, braname);

  branches.erase(branch);
  
  // отключаем участников кооператива от кооперативного участка
  action(
    permission_level{ _branch, "active"_n},
    _soviet,
    "deletebranch"_n,
    std::make_tuple(coopname, braname)
  ).send();

  uint64_t new_count = sub_branch_count(coopname);
  
  if (coop.is_branched && new_count < 3) { //отключаем систему КУ, если их меньше 3
    action(
        permission_level{ _branch, "active"_n},
        _registrator,
        "disbranches"_n,
        std::make_tuple(coopname)
      ).send();
  }
};