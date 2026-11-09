/**
 * @brief Стереть строку прогона участка (задача 99D-21, КЭУ-3).
 *
 * Строк прогона у участка в оперативной памяти цепи не больше двух: текущий
 * и предыдущий (ради резерва прошлого прогона). Позапрошлую строку стирает
 * ИСТОК перед расчётом нового прогона; история прогонов хранится в его базе.
 * Контракт даты не проверяет: когда стирать, решает ИСТОК.
 *
 * Guards: авторизация кооператива; строка есть.
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::delperiod(eosio::name coopname, eosio::name braname, uint32_t period) {
  require_auth(coopname);

  kuperiods_index periods(_marketplace, coopname.value);
  auto idx = periods.get_index<"bybrperiod"_n>();
  auto it = idx.find(combine_ids(braname.value, period));
  eosio::check(it != idx.end(),
               "MARKETPLACE_PERIOD_NOT_CLOSED: Итог участка за период не рассчитан");
  idx.erase(it);
}
