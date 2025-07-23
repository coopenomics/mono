/**
\ingroup public_actions
\brief Завершение процесса поставки в направлении deliver_on_order (completeord).

@details После истечения гарантийного срока и успешного получения товара заказчиком, процесс поставки завершается. Обновляются статусы, количество объектов, происходят финансовые операции.

Процесс: ORDER (parent) → OFFER (child)
- Финализация денежного и имущественного паевых взносов

@param coopname Имя кооператива
@param username Имя пользователя, инициирующего завершение
@param request_hash Хэш встречной заявки (offer)

@note Авторизация требуется от аккаунта: @p coopname
*/
[[eosio::action]] void marketplace::completeord(eosio::name coopname, eosio::name username, checksum256 request_hash) { 
  require_auth(coopname);
      
  requests_index requests(_marketplace, coopname.value);
  auto change_opt = Marketplace::get_request_by_hash(coopname, request_hash);
  eosio::check(change_opt.has_value(), "Заявка не найдена");
  auto change = change_opt.value();
  
  eosio::check(change.type == "offer"_n, "Метод completeord применим только к заявкам типа offer");
  eosio::check(change.parent_id > 0, "У встречной заявки должна быть родительская заявка");

  auto parent_change_opt = Marketplace::get_request_by_hash(coopname, change.parent_hash);
  eosio::check(parent_change_opt.has_value(), "Родительская заявка не найдена");
  auto parent_change = parent_change_opt.value();
  
  eosio::check(parent_change.type == "order"_n, "Родительская заявка должна быть типа order");
  eosio::check(change.status == "recconfirmed"_n, "Завершение возможно только в статусе recconfirmed");

  // Обновляем родительскую заявку (order)
  auto parent_itr = requests.find(parent_change.id);
  requests.erase(parent_itr);

  // Обновляем встречную заявку (offer)
  auto change_itr = requests.find(change.id);
  requests.erase(change_itr);
  
  auto program = get_program_or_fail(coopname, _marketplace_program_id);
  std::string memo = "Успешное завершение поставки имущества по программе №" + std::to_string(_marketplace_program_id) + " с ID: " + std::to_string(change.id);

  // Заказчику разблокируем баланс и списываем его  
  Wallet::sub_blocked_funds(_marketplace, coopname, change.money_contributor, change.total_cost, _marketplace_program, memo);
  
  // Поставщику разблокируем средства в программе
  Wallet::unblock_funds(_marketplace, coopname, change.product_contributor, change.supplier_amount, _marketplace_program, memo);

  // Обрабатываем членские взносы
  if (change.membership_fee_amount.amount > 0) {
    // Сохраняем членский взнос в программе для дальнейшего списания
    Wallet::add_member_fee(_marketplace, coopname, change.money_contributor, _marketplace_program_id, change.membership_fee_amount, memo);
  }

  // Извлекаем сегменты для завершения
  auto return_segment = marketplace::get_segment_by_request_and_type(coopname, change.id, marketplace::valid_segment("return"));
  auto contribution_segment = marketplace::get_segment_by_request_and_type(coopname, change.id, marketplace::valid_segment("contribute"));
  
  // Завершаем сегмент возврата (для заказчика)
  Marketplace::complete_segment(change, request_hash, return_segment, _product_return_action, change.money_contributor);
  
  // Завершаем сегмент взноса (для поставщика)
  Marketplace::complete_segment(change, request_hash, contribution_segment, _product_contribution_action, change.product_contributor);
  
  // Удаляем сегменты встречной заявки
  marketplace::delete_segments_by_request(coopname, change.id);
  
  // Удаляем встречную заявку
  requests.erase(change);
} 