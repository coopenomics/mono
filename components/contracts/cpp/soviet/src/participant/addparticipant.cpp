/**
 * @ingroup public_actions
 * @brief  Добавление пайщика по API без процедуры подписания заявления на вступление.
 * Действие добавляет действующего пайщика в систему, пропуская этап подписи заявления на вступление и оплату вступительного и минимального паевого взносов.
 * Система позволяет установить дату регистрации участника, которая будет соответствовать дате уплаты им минимального и вступительного взносов.
 * Если spread_initial установлен в false, то сумма вступительного взноса не распределяется среди фондов. Тогда система считает, что учет распределения вступительного взноса произошел за её пределами. 
 * Если spread_initial установлен в true, то сумма вступительного взноса распределяется по фондам согласно правилам распределения кооператива в контракте fund.
 * Минимальный паевой взнос всегда добавляется в кошелёк пайщика и отмечается в статистике оборотного фонда кооператива.
 *
 * @param[in]  coopname        The coopname
 * @param[in]  username        The username
 * @param[in]  type            The type
 * @param[in]  created_at      The created at
 * @param[in]  initial         The initial
 * @param[in]  minimum         The minimum
 * @param[in]  spread_initial  The spread initial
 *
 */
void soviet::addpartcpnt(eosio::name coopname, eosio::name username, eosio::name braname, eosio::name type, eosio::time_point_sec created_at, eosio::asset initial, eosio::asset minimum, bool spread_initial) {
  check_auth_and_get_payer_or_fail(contracts_whitelist);
  
  auto cooperative = get_cooperative_or_fail(coopname);

  accounts_index accounts(_registrator, _registrator.value);
  auto account = accounts.find(username.value);

  eosio::check(account != accounts.end(), "Аккаунт не найден");
  
  participants_index participants(_soviet, coopname.value);
  
  participants.emplace(_soviet, [&](auto &m){
    m.username = username;
    m.braname = braname;
    m.created_at = created_at;
    m.last_update = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());
    m.last_min_pay = created_at;
    m.status = "accepted"_n;
    m.is_initial = true;
    m.is_minimum = true;
    m.has_vote = true;    
    m.type = type;
    m.minimum_amount = minimum; 
    m.initial_amount = initial;
  });

}
