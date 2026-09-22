
/**
 * @brief Обновление параметров кооператива.
 * Обновляет параметры кооператива (взносы, описание)
 * @param coopname Наименование кооператива
 * @param username Имя пользователя-обновителя
 * @param initial Вступительный взнос для физических лиц
 * @param minimum Минимальный взнос для физических лиц
 * @param org_initial Вступительный взнос для организаций
 * @param org_minimum Минимальный взнос для организаций
 * @param announce Анонс кооператива
 * @param description Описание кооператива
 * @ingroup public_actions
 * @ingroup public_registrator_actions

 * @note Авторизация требуется от аккаунта: @p provider, @p coopname или @p username
 */
[[eosio::action]] void registrator::updatecoop(eosio::name coopname, eosio::name username, eosio::asset initial, eosio::asset minimum, eosio::asset org_initial, eosio::asset org_minimum, std::string announce, std::string description)
{
  
  if (!has_auth(_provider)){
    check_auth_or_fail(_registrator, coopname, username, "updatecoop"_n);  
  };
  
  accounts_index accounts(_registrator, _registrator.value);

  auto account = accounts.find(username.value);

  eosio::check(account != accounts.end(), "Аккаунт не зарегистрирован");

  cooperatives2_index coops(_registrator, _registrator.value);
  auto org = coops.find(coopname.value);

  eosio::check(org != coops.end(), "Организация не найдена");
  eosio::check(org -> is_cooperative, "Кооператив не найден");

  eosio::check(initial.symbol == minimum.symbol && minimum.symbol == _root_govern_symbol, "Неверные символы взносов");
  eosio::check(org_initial.symbol == org_minimum.symbol && org_minimum.symbol == _root_govern_symbol, "Неверные символы взносов");

  eosio::check(initial.amount > 0 && org_initial.amount > 0 && minimum.amount > 0 && org_minimum.amount > 0, "Вступительный и минимальный паевые взносы должны быть положительными");

  coops.modify(org, RamPayer::of(coops, coopname), [&](auto &o){
    o.initial = initial;
    o.minimum = minimum;
    o.registration = initial + minimum;

    o.org_initial = org_initial;
    o.org_minimum = org_minimum;
    o.org_registration = org_minimum + org_initial;

    o.announce = announce;
    o.description = description;
  });

}
