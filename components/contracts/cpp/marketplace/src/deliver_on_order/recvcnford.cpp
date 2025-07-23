/**
\ingroup public_actions
\brief Подтверждение получения товара заказчиком для направления deliver_on_order (recvcnford).

@details Председатель совета подтверждает получение имущества заказчиком на основе предоставленного документа.
Встречная заявка должна быть предварительно в статусе "получено".

Процесс: ORDER (parent) → OFFER (child)
- Parent: денежный паевой взнос (заказчик)
- Child: имущественный паевой взнос (поставщик)

@param coopname Имя кооператива
@param username Имя председателя совета
@param request_hash Хэш встречной заявки (offer)
@param document Документ подтверждения получения

@note Авторизация требуется от аккаунта: @p coopname
*/
[[eosio::action]] void marketplace::recvcnford(eosio::name coopname, eosio::name username, checksum256 request_hash, document2 document) {
  require_auth(coopname);

  requests_index requests(_marketplace, coopname.value);
  auto change_opt = Marketplace::get_request_by_hash(coopname, request_hash);
  eosio::check(change_opt.has_value(), "Заявка не найдена");
  auto change = change_opt.value();

  eosio::check(change.status == "received1"_n, "Подтверждение получения возможно только после получения");
  eosio::check(change.type == "offer"_n, "Метод recvcnford применим только к заявкам типа offer");
  eosio::check(change.parent_id > 0, "У встречной заявки должна быть родительская заявка");

  auto parent_change_opt = Marketplace::get_request_by_hash(coopname, change.parent_hash);
  eosio::check(parent_change_opt.has_value(), "Родительская заявка не найдена");
  auto parent_change = parent_change_opt.value();
  
  eosio::check(parent_change.type == "order"_n, "Родительская заявка должна быть типа order");

  auto branch = get_branch_or_fail(coopname, change.braname);
  eosio::check(change.money_contributor == username, "Недостаточно прав доступа для получения имущества");

  //проводим проверку подписи документа
  verify_document_or_fail(document);

  // Уменьшаем паевой фонд на сумму возвращаемой стоимости имущества заказчику
  Fund::sub_circulating_funds(_marketplace, coopname, parent_change.total_cost, false);

  // Обновляем статус встречной заявки
  auto change_itr = requests.find(change.id);
  eosio::check(change_itr != requests.end(), "Встречная заявка не найдена для обновления");
  requests.modify(change_itr, _marketplace, [&](auto &o) { 
    o.status = "received2"_n;
  });

  // Проверяем инварианты дочерней заявки
  auto updated_change = requests.find(change.id);
  marketplace::check_units_invariant(*updated_change, "orderrecconfirm_update");

  // Обновляем return сегмент документом подтверждения
  marketplace::update_segment_by_request_and_type(coopname, change.id, marketplace::valid_segment("c2r"), [&](auto &s) {
    s.act2 = document;
    s.status = "received2"_n;
  });
} 