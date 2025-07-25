/**
\ingroup public_actions
\brief Прием имущества водителем для транспортировки в направлении deliver_on_offer (deliveroff2).

@details Водитель (пайщик) принимает имущество в транспортировку.

Процесс: OFFER (parent) → ORDER (child)
- Этап 2 из 4: Прием имущества водителем

@param coopname Имя кооператива
@param username Имя водителя (пайщик)
@param request_hash Хэш встречной заявки (order)
@param transport_act_2 Акт приема имущества водителем

@note Авторизация требуется от аккаунта: @p coopname
**/
[[eosio::action]] void marketplace::deliveroff2(eosio::name coopname, eosio::name username, checksum256 request_hash, document2 transport_act_2) {
  require_auth(coopname);

  requests_index requests(_marketplace, coopname.value);
  auto change_opt = Marketplace::get_request_by_hash(coopname, request_hash);
  eosio::check(change_opt.has_value(), "Заявка не найдена");
  auto change = change_opt.value();
  
  eosio::check(change.status == "delivered1"_n, "Прием в транспортировку возможен только в статусе delivered1");
  eosio::check(change.type == "order"_n, "Метод deliveroff2 применим только к заявкам типа order");
  eosio::check(change.parent_id > 0, "У встречной заявки должна быть родительская заявка");

  auto parent_change_opt = Marketplace::get_request_by_hash(coopname, change.parent_hash);
  eosio::check(parent_change_opt.has_value(), "Родительская заявка не найдена");
  auto parent_change = parent_change_opt.value();
  
  eosio::check(parent_change.type == "offer"_n, "Родительская заявка должна быть типа offer");

  // Проверяем, что пользователь является пайщиком кооператива
  get_participant_or_fail(coopname, username);

  // Проверяем подпись документа
  verify_document_or_fail(transport_act_2, { username });

  // Обновляем статус встречной заявки
  auto change_itr = requests.find(change.id);
  eosio::check(change_itr != requests.end(), "Встречная заявка не найдена для обновления");
  requests.modify(change_itr, _marketplace, [&](auto &o) { 
    o.status = "delivered2"_n;
  });

  // Сохраняем акт приема водителем в сегменте s2c
  marketplace::update_segment_by_request_and_type(coopname, change.id, marketplace::valid_segment("s2c"), [&](auto &s) {
    s.transport_act_2 = transport_act_2;
    s.driver_username = username; // Водитель, который принял имущество
  });

  // Проверяем инварианты дочерней заявки
  auto updated_change = requests.find(change.id);
  marketplace::check_units_invariant(*updated_change, "deliveroff2_child_update");
} 