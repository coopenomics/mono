/**
 * @brief Редактирование адреса кооператива
 * Изменяет данные существующего адреса в системе кооператива.
 * Позволяет обновить привязку к филиалу и данные адреса.
 * @param coopname Наименование кооператива
 * @param chairman Наименование председателя совета
 * @param braname Наименование филиала (может быть пустым для общего адреса)
 * @param address_id Идентификатор адреса для редактирования
 * @param data Новые данные адреса (структура address_data)
 * @ingroup public_actions
 * @ingroup public_soviet_actions

 * @note Авторизация требуется от аккаунта: @p chairman
 */
void soviet::editaddress(eosio::name coopname, eosio::name chairman, eosio::name braname, uint64_t address_id, address_data data){

  require_auth(chairman);

  auto cooperative = get_cooperative_or_fail(coopname);  

  addresses_index addresses(_soviet, coopname.value);
 
  auto address = addresses.find(address_id);
  eosio::check(address != addresses.end(), "Адрес не найден");

  if (braname != ""_n) {
    auto branch = get_branch_or_fail(coopname, braname);
  };

  addresses.modify(address, RamPayer::of(addresses, coopname), [&](auto &a){
    a.braname = braname;
    a.data = data;
  });

}