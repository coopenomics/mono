/**
\ingroup public_actions
\brief Подпись акта получения имущества заказчиком в направлении deliver_on_offer (recvoff).

@details Заказчик подписывает акт получения имущества от поставщика.

Процесс: OFFER (parent) → ORDER (child)
- Заказчик (автор child order) получает имущество от поставщика

@param coopname Имя кооператива
@param username Имя заказчика
@param request_hash Хэш встречной заявки (order)
@param document Акт получения имущества

@note Авторизация требуется от аккаунта: @p coopname
**/
[[eosio::action]] void marketplace::recvoff(eosio::name coopname, eosio::name username, checksum256 request_hash, document2 document) { 
  require_auth(coopname);

  requests_index requests(_marketplace, coopname.value);
  auto change_opt = Marketplace::get_request_by_hash(coopname, request_hash);
  eosio::check(change_opt.has_value(), "Заявка не найдена");
  auto change = change_opt.value();
  
  eosio::check(change.type == "order"_n, "Метод offerrecieve применим только к заявкам типа order");
  eosio::check(change.parent_id > 0, "У встречной заявки должна быть родительская заявка");

  auto parent_change_opt = Marketplace::get_request_by_hash(coopname, change.parent_hash);
  eosio::check(parent_change_opt.has_value(), "Родительская заявка не найдена");
  auto parent_change = parent_change_opt.value();
  
  eosio::check(parent_change.type == "offer"_n, "Родительская заявка должна быть типа offer");

  eosio::check(change.status == "delivered"_n, "Имущество может быть получено только в статусе delivered");
  eosio::check(change.deadline_for_receipt.sec_since_epoch() >= eosio::current_time_point().sec_since_epoch(), "Время на получение имущества истекло");
  
  auto branch = get_branch_or_fail(coopname, change.braname);
  
  //Проверяем права доступа на КУ (председатель или доверенное лицо)
  eosio::check(branch.is_user_authorized(username), "Недостаточно прав доступа для выдачи имущества");
  
  // Проверяем подпись документа
  verify_document_or_fail(document);

  // Обновляем статус и устанавливаем гарантийную задержку
  auto change_itr = requests.find(change.id);
  eosio::check(change_itr != requests.end(), "Заявка не найдена для обновления");
  requests.modify(change_itr, coopname, [&](auto &ch){
    ch.status = "received1"_n;
  });

  // Сохраняем акт получения в return сегменте
  marketplace::update_segment_by_request_and_type(coopname, change.id, marketplace::valid_segment("c2r"), [&](auto &s) {
    s.act1 = document;
    s.status = "received"_n;
  });
} 