/**
 * @brief Включение режима филиалов.
 * Включает режим кооперативных участков для кооператива
 * @param coopname Наименование кооператива
 * @ingroup public_actions
 * @ingroup public_registrator_actions

 * @note Авторизация требуется от аккаунта: @p branch
 */
[[eosio::action]] void registrator::enabranches(eosio::name coopname) {
  require_auth(_branch);

  auto cooperative = get_cooperative_or_fail(coopname);
  
  cooperatives2_index coops(_registrator, _registrator.value);
  auto coop = coops.find(coopname.value);
  
  // Сигнал контракта участков: участков стало не меньше MIN_BRANCHES_COUNT.
  // Флаг ставит пересчёт: он учитывает и число активных пайщиков.
  sync_branched(coops, coop);
};
