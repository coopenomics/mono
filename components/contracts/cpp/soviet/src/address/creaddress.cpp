/**
 * @brief Создание нового адреса кооператива
 * Создает новый адрес в системе кооператива с указанными данными.
 * Адрес может быть привязан к конкретному филиалу или быть общим для кооператива.
 * @param coopname Наименование кооператива
 * @param chairman Наименование председателя совета
 * @param braname Наименование филиала (может быть пустым для общего адреса)
 * @param data Данные адреса (структура address_data)
 * @ingroup public_actions
 * @ingroup public_soviet_actions

 * @note Авторизация требуется от аккаунта: @p chairman
 */
void soviet::creaddress(eosio::name coopname, eosio::name chairman, eosio::name braname, address_data data) {

  require_auth(chairman);

  auto cooperative = get_cooperative_or_fail(coopname);  

  if (braname != ""_n) {
    auto branch = get_branch_or_fail(coopname, braname);
  };

  addresses_index addresses(_soviet, coopname.value);
  auto id = get_global_id(_soviet, "addresses"_n);
  
  addresses.emplace(RamPayer::of(addresses, coopname), [&](auto &a){
    a.id = id;
    a.coopname = coopname;
    a.braname = braname;
    a.data = data;
  });

}
