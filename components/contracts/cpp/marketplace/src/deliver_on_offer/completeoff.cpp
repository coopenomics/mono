/**
\ingroup public_actions
\brief Завершение поставки в направлении deliver_on_offer (completeoff).

@details После истечения гарантийной задержки завершает поставку и переводит единицы из заблокированных в доставленные.

Процесс: OFFER (parent) → ORDER (child)
- Завершение происходит после истечения warranty_delay

@param coopname Имя кооператива
@param username Имя пользователя
@param request_hash Хэш встречной заявки (order)

@note Авторизация требуется от аккаунта: @p coopname
**/
[[eosio::action]] void marketplace::completeoff(eosio::name coopname, eosio::name username, checksum256 request_hash) { 
  require_auth(coopname);
      
  requests_index requests(_marketplace, coopname.value);
  auto change_opt = Marketplace::get_request_by_hash(coopname, request_hash);
  eosio::check(change_opt.has_value(), "Заявка не найдена");
  auto change = change_opt.value();
  
  eosio::check(change.type == "order"_n, "Метод completeoff применим только к заявкам типа order");
  eosio::check(change.parent_id > 0, "У встречной заявки должна быть родительская заявка");

  auto parent_change_opt = Marketplace::get_request_by_hash(coopname, change.parent_hash);
  eosio::check(parent_change_opt.has_value(), "Родительская заявка не найдена");
  auto parent_change = parent_change_opt.value();
  
  eosio::check(parent_change.type == "offer"_n, "Родительская заявка должна быть типа offer");
  
  eosio::check(change.status == "received2"_n, "Завершение возможно только в статусе received2");
  eosio::check(change.warranty_delay_until.sec_since_epoch() < eosio::current_time_point().sec_since_epoch(), "Время гарантийной задержки еще не истекло");

  // Удаляем родительскую заявку (offer)
  auto parent_itr = requests.find(parent_change.id);
  requests.erase(parent_itr);
  
  // Удаляем встречную заявку (order)
  auto change_itr = requests.find(change.id);
  requests.erase(change_itr);
  
  // Обрабатываем членские взносы (увеличиваем счёт кооператива согласно ТЗ)
  if (change.membership_fee_amount.amount > 0) {
    std::string member_fee_memo = "Членский взнос по программе №" + std::to_string(_marketplace_program_id) + " с идентификатором: " + checksum256_to_hex(change.hash);
    Wallet::add_member_fee(_marketplace, coopname, change.product_contributor, _marketplace_program_id, change.membership_fee_amount, member_fee_memo);
  }
  // Удаляем все сегменты, связанные с заявкой
  marketplace::delete_segments_by_request(coopname, change.id);
  
  std::string memo = "Возврат паевого взноса по программе №" + std::to_string(_marketplace_program_id) + " с идентификатором: " + checksum256_to_hex(change.hash) + "в ЦПП 'Цифровой Кошелёк'";
  
  // Поставщику списываем средства в программе маркетплейса (base_cost согласно ТЗ)
  Wallet::sub_blocked_funds(_marketplace, coopname, change.product_contributor, change.base_cost, _marketplace_program, memo);
  
  // Поставщику начисляем средства в ЦПП Цифровой Кошелек (base_cost согласно ТЗ)
  Wallet::add_available_funds(_marketplace, coopname, change.product_contributor, change.base_cost, _wallet_program, memo);
} 