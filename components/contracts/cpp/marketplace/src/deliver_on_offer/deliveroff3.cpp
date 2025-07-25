/**
\ingroup public_actions
\brief Доставка имущества до КУ водителем в направлении deliver_on_offer (deliveroff3).

@details Водитель (пайщик) доставляет имущество до кооперативного участка получателя.

Процесс: OFFER (parent) → ORDER (child)
- Этап 3 из 4: Доставка до КУ водителем

@param coopname Имя кооператива
@param username Имя водителя (пайщик)
@param request_hash Хэш встречной заявки (order)
@param transport_act_3 Акт доставки до КУ

@note Авторизация требуется от аккаунта: @p coopname
**/
[[eosio::action]] void marketplace::deliveroff3(eosio::name coopname, eosio::name username, checksum256 request_hash, document2 transport_act_3) {
  require_auth(coopname);

  requests_index requests(_marketplace, coopname.value);
  auto change_opt = Marketplace::get_request_by_hash(coopname, request_hash);
  eosio::check(change_opt.has_value(), "Заявка не найдена");
  auto change = change_opt.value();
  
  eosio::check(change.status == "delivered2"_n, "Доставка до КУ возможна только в статусе delivered2");
  eosio::check(change.type == "order"_n, "Метод deliveroff3 применим только к заявкам типа order");
  eosio::check(change.parent_id > 0, "У встречной заявки должна быть родительская заявка");

  auto parent_change_opt = Marketplace::get_request_by_hash(coopname, change.parent_hash);
  eosio::check(parent_change_opt.has_value(), "Родительская заявка не найдена");
  auto parent_change = parent_change_opt.value();
  
  eosio::check(parent_change.type == "offer"_n, "Родительская заявка должна быть типа offer");

  // Проверяем, что пользователь является пайщиком кооператива
  get_participant_or_fail(coopname, username);

  // Проверяем подпись документа
  verify_document_or_fail(transport_act_3, { username });

  // Обновляем статус встречной заявки
  auto change_itr = requests.find(change.id);
  eosio::check(change_itr != requests.end(), "Встречная заявка не найдена для обновления");
  requests.modify(change_itr, _marketplace, [&](auto &o) { 
    o.status = "delivered3"_n;
    o.delivered_at = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());
  });

  // Сохраняем акт доставки до КУ в сегменте s2c
  marketplace::update_segment_by_request_and_type(coopname, change.id, marketplace::valid_segment("s2c"), [&](auto &s) {
    s.transport_act_3 = transport_act_3;
  });

  // Проверяем инварианты дочерней заявки
  auto updated_change = requests.find(change.id);
  marketplace::check_units_invariant(*updated_change, "deliveroff3_child_update");
} 