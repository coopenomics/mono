/**
\ingroup public_actions
\brief Начало транспортировки имущества в направлении deliver_on_offer (deliveroff1).

@details Председатель или уполномоченный КУ передает имущество на транспортировку.

Процесс: OFFER (parent) → ORDER (child)
- Этап 1 из 4: Передача имущества на транспортировку

@param coopname Имя кооператива
@param username Имя председателя или уполномоченного КУ
@param request_hash Хэш встречной заявки (order)
@param transport_act_1 Акт передачи имущества на транспортировку

@note Авторизация требуется от аккаунта: @p coopname
**/
[[eosio::action]] void marketplace::deliveroff1(eosio::name coopname, eosio::name username, checksum256 request_hash, document2 transport_act_1) {
  require_auth(coopname);

  requests_index requests(_marketplace, coopname.value);
  auto change_opt = Marketplace::get_request_by_hash(coopname, request_hash);
  eosio::check(change_opt.has_value(), "Заявка не найдена");
  auto change = change_opt.value();
  
  eosio::check(change.status == "supplied2"_n, "Только поставка с подтверждением может быть отправлена на транспортировку");
  eosio::check(change.type == "order"_n, "Метод deliveroff1 применим только к заявкам типа order");
  eosio::check(change.parent_id > 0, "У встречной заявки должна быть родительская заявка");

  auto parent_change_opt = Marketplace::get_request_by_hash(coopname, change.parent_hash);
  eosio::check(parent_change_opt.has_value(), "Родительская заявка не найдена");
  auto parent_change = parent_change_opt.value();
  
  eosio::check(parent_change.type == "offer"_n, "Родительская заявка должна быть типа offer");

  auto branch = get_branch_or_fail(coopname, change.braname);
  
  //Проверяем права доступа на КУ (председатель или доверенное лицо)
  eosio::check(branch.is_user_authorized(username), "Недостаточно прав доступа для передачи имущества на транспортировку");

  // Проверяем подпись документа
  verify_document_or_fail(transport_act_1, { username });

  // Обновляем статус встречной заявки
  auto change_itr = requests.find(change.id);
  eosio::check(change_itr != requests.end(), "Встречная заявка не найдена для обновления");
  requests.modify(change_itr, _marketplace, [&](auto &o) { 
    o.status = "delivered1"_n;
    o.supplied_units = o.blocked_units;
  });

  // Сохраняем акт передачи на транспортировку в сегменте s2c
  marketplace::update_segment_by_request_and_type(coopname, change.id, marketplace::valid_segment("s2c"), [&](auto &s) {
    s.transport_act_1 = transport_act_1;
    s.coopactor = username; // Представитель кооператива, который передал имущество на транспортировку
  });

  // Проверяем инварианты дочерней заявки
  auto updated_change = requests.find(change.id);
  marketplace::check_units_invariant(*updated_change, "deliveroff1_child_update");
} 