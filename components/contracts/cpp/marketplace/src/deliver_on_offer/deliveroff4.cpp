/**
\ingroup public_actions
\brief Прием имущества председателем КУ в направлении deliver_on_offer (deliveroff4).

@details Председатель кооперативного участка принимает доставленное имущество.

Процесс: OFFER (parent) → ORDER (child)
- Этап 4 из 4: Прием имущества председателем КУ

@param coopname Имя кооператива
@param username Имя председателя КУ
@param request_hash Хэш встречной заявки (order)
@param transport_act_4 Акт приема имущества председателем КУ

@note Авторизация требуется от аккаунта: @p coopname
**/
[[eosio::action]] void marketplace::deliveroff4(eosio::name coopname, eosio::name username, checksum256 request_hash, document2 transport_act_4) {
  require_auth(coopname);

  requests_index requests(_marketplace, coopname.value);
  auto change_opt = Marketplace::get_request_by_hash(coopname, request_hash);
  eosio::check(change_opt.has_value(), "Заявка не найдена");
  auto change = change_opt.value();
  
  eosio::check(change.status == "delivered3"_n, "Прием имущества председателем возможен только в статусе delivered3");
  eosio::check(change.type == "order"_n, "Метод deliveroff4 применим только к заявкам типа order");
  eosio::check(change.parent_id > 0, "У встречной заявки должна быть родительская заявка");

  auto parent_change_opt = Marketplace::get_request_by_hash(coopname, change.parent_hash);
  eosio::check(parent_change_opt.has_value(), "Родительская заявка не найдена");
  auto parent_change = parent_change_opt.value();
  
  eosio::check(parent_change.type == "offer"_n, "Родительская заявка должна быть типа offer");

  auto branch = get_branch_or_fail(coopname, change.braname);
  
  //Проверяем права доступа на КУ (председатель или доверенное лицо)
  eosio::check(branch.is_user_authorized(username), "Недостаточно прав доступа для приема имущества");
  
  // Проверяем подпись документа
  verify_document_or_fail(transport_act_4, { username });

  // Обновляем статус встречной заявки
  auto change_itr = requests.find(change.id);
  eosio::check(change_itr != requests.end(), "Встречная заявка не найдена для обновления");
  requests.modify(change_itr, _marketplace, [&](auto &o) { 
    o.status = "delivered4"_n;
    o.deadline_for_receipt = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch() + 3 * 24 * 60 * 60); // 3 дня на получение
  });

  // Проверяем инварианты дочерней заявки
  auto updated_change = requests.find(change.id);
  marketplace::check_units_invariant(*updated_change, "deliveroff4_child_update");

  // Сохраняем акт приема председателем КУ в сегменте s2c
  marketplace::update_segment_by_request_and_type(coopname, change.id, marketplace::valid_segment("s2c"), [&](auto &s) {
    s.transport_act_4 = transport_act_4;
    s.receive_from_driver_coopactor = username; // Председатель КУ, который принял имущество
  });
} 