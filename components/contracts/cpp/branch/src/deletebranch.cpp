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

  // Участок нельзя удалить, пока на нём держится экономика Стола заказов:
  // заказы с выдачей или приёмкой на этом участке (и заявки на возврат по ним)
  // упёрлись бы в «участок не найден», а остаток общего кошелька участка
  // осиротел бы (задача 99D-16).
  Marketplace::orders_index orders(_marketplace, coopname.value);
  auto by_delivery = orders.get_index<"bydelivbra"_n>();
  eosio::check(by_delivery.find(braname.value) == by_delivery.end(),
               "Кооперативный участок нельзя удалить: на нём есть заказы Стола заказов к выдаче — завершите или отмените их");
  auto by_accept = orders.get_index<"byacceptbra"_n>();
  eosio::check(by_accept.find(braname.value) == by_accept.end(),
               "Кооперативный участок нельзя удалить: на нём есть заказы Стола заказов, принятые от поставщиков — завершите их");

  userwallets_index user_wallets(_ledger2, coopname.value);
  auto wallets_idx = user_wallets.get_index<"byuserwallet"_n>();
  auto common = wallets_idx.find(combine_ids(ledger2_wallets::BRANCH_COMMON.value, braname.value));
  eosio::check(common == wallets_idx.end() || common->available.amount == 0,
               std::string{"Кооперативный участок нельзя удалить: в общем кошельке участка остаток "} +
                 (common == wallets_idx.end() ? std::string{} : common->available.to_string()) +
                 " — распределите или израсходуйте его");

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