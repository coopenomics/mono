/**
\ingroup public_actions
\brief Получение товара для направления deliver_on_order (recvord).

@details Данный метод позволяет заказчику подтвердить получение имущества и предоставить акт получения.
Встречная заявка должна быть предварительно в статусе "доставлено".

Процесс: ORDER (parent) → OFFER (child)  
- Parent: денежный паевой взнос (заказчик)
- Child: имущественный паевой взнос (поставщик)

@param coopname Имя кооператива
@param username Имя заказчика
@param request_hash Хэш встречной заявки (offer)
@param document Акт получения имущества

@note Авторизация требуется от аккаунта: @p coopname
**/
[[eosio::action]] void marketplace::recvord(eosio::name coopname, eosio::name username, checksum256 request_hash, document2 document) { 
  require_auth(coopname);

  requests_index requests(_marketplace, coopname.value);
  auto change_opt = Marketplace::get_request_by_hash(coopname, request_hash);
  eosio::check(change_opt.has_value(), "Заявка не найдена");
  auto change = change_opt.value();

  eosio::check(change.status == "delivered"_n, "Только доставленная заявка может быть получена");
  eosio::check(change.type == "offer"_n, "Метод orderreceive применим только к заявкам типа offer");
  eosio::check(change.parent_id > 0, "У встречной заявки должна быть родительская заявка");

  auto parent_change_opt = Marketplace::get_request_by_hash(coopname, change.parent_hash);
  eosio::check(parent_change_opt.has_value(), "Родительская заявка не найдена");
  auto parent_change = parent_change_opt.value();
  
  eosio::check(parent_change.type == "order"_n, "Родительская заявка должна быть типа order");

  auto branch = get_branch_or_fail(coopname, change.braname);
  //Проверяем права доступа на КУ (председатель или доверенное лицо)
  eosio::check(branch.is_user_authorized(username), "Недостаточно прав доступа для передачи имущества");

  //проводим проверку подписи документа
  verify_document_or_fail(document);

  // Обновляем статус встречной заявки
  auto change_itr = requests.find(change.id);
  eosio::check(change_itr != requests.end(), "Встречная заявка не найдена для обновления");
  requests.modify(change_itr, _marketplace, [&](auto &o) { 
    o.status = "received1"_n;
    o.received_at = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());
  });

  // Проверяем инварианты дочерней заявки
  auto updated_change = requests.find(change.id);
  marketplace::check_units_invariant(*updated_change, "orderreceive_update");

  // Обновляем return сегмент документом получения
  marketplace::update_segment_by_request_and_type(coopname, change.id, marketplace::valid_segment("c2r"), [&](auto &s) {
    s.act1 = document;
    s.status = "received1"_n;
  });
} 