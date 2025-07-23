/**
\ingroup public_actions
\brief Отмена заявки и возврат токенов.

@details Позволяет пользователю отменить родительскую или дочернюю заявку, а также обеспечивает возврат токенов владельцу (если применимо). При отмене проверяется наличие заявки и её текущий статус. 

@param username Имя пользователя, инициировавшего отмену.
@param request_hash Хэш заявки для отмены.

@note Авторизация требуется от аккаунта: @p username
*/
[[eosio::action]] void marketplace::cancel(eosio::name coopname, eosio::name username, checksum256 request_hash) { 
  require_auth(coopname);
  
  requests_index requests(_marketplace, coopname.value);
  auto change_opt = Marketplace::get_request_by_hash(coopname, request_hash);
  eosio::check(change_opt.has_value(), "Заявка не найдена");
  auto change = change_opt.value();
  
  //TODO перенести под проверку пользователя и вообще сценарий отмены проверить полностью
  eosio::check(change.status != "accepted"_n, "Заявка не может быть отменена сейчас");

  if (change.parent_id == 0) {
    marketplace::cancel_parent(coopname, username, request_hash);
  } else {
    marketplace::cancel_child(coopname, username, request_hash);
  };
}


/**
 * @brief Отмена родительской заявки.
 */
 void marketplace::cancel_parent(eosio::name coopname, eosio::name username, checksum256 request_hash) {
  requests_index requests(_marketplace, coopname.value);
  auto change_opt = Marketplace::get_request_by_hash(coopname, request_hash);
  eosio::check(change_opt.has_value(), "Заявка не найдена");
  auto change = change_opt.value();

  //Удаление, если заблокированных объектов на поставке - нет.   
  eosio::check(change.remain_units + change.blocked_units == 0, "Заявка не может быть отменена из-за наличия заблокированных единиц товара");
  
  auto change_itr = requests.find(change.id);
  eosio::check(change_itr != requests.end(), "Заявка не найдена для удаления");
  requests.erase(change_itr);
};

/**
 * @brief Отмена дочерней заявки.
 */
void marketplace::cancel_child(eosio::name coopname, eosio::name username, checksum256 request_hash) {
  requests_index requests(_marketplace, coopname.value);
  auto change_opt = Marketplace::get_request_by_hash(coopname, request_hash);
  eosio::check(change_opt.has_value(), "Заявка не найдена");
  auto change = change_opt.value();
  
  auto parent_change_opt = Marketplace::get_request_by_hash(coopname, change.parent_hash);
  eosio::check(parent_change_opt.has_value(), "Родительская заявка не найдена");
  auto parent_change = parent_change_opt.value();
  eosio::asset quantity = change.unit_cost * change.blocked_units;

  // оповещаем совет об отмене и разблокируем средства
  if (change.type == "order"_n) {
    std::string memo = "Отмена поставки по программе №" + std::to_string(_marketplace_program_id) + " с ID: " + std::to_string(change.id);

    Wallet::unblock_funds(_marketplace, coopname, change.money_contributor, change.total_cost, _marketplace_program, memo);
  };  

  if (change.status == "authorized"_n || change.status == "accepted"_n) {
    //возвращаем единицы товара в родительскую заявку для статусов с заблокированными единицами
    if (change.blocked_units > 0) {
      auto parent_itr = requests.find(parent_change.id);
      eosio::check(parent_itr != requests.end(), "Родительская заявка не найдена для обновления");
      requests.modify(parent_itr, _marketplace, [&](auto &e) {
        e.remain_units += change.blocked_units;
        e.blocked_units -= change.blocked_units;
        e.supplier_amount = e.remain_units * e.unit_cost;
      });
    }

    auto change_itr = requests.find(change.id);
    eosio::check(change_itr != requests.end(), "Заявка не найдена для обновления");
    requests.modify(change_itr, _marketplace, [&](auto &c){
      c.status = "canceled"_n;
      c.canceled_at = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());
      c.blocked_units = 0; // Обнуляем заблокированные единицы
    });

  } else if (change.status == "active"_n) {

    auto change_itr = requests.find(change.id);
    eosio::check(change_itr != requests.end(), "Заявка не найдена для обновления");
    requests.modify(change_itr, _marketplace, [&](auto &c){
      c.status = "canceled"_n;
      c.canceled_at = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());
    });

  } else {
    //TODO здесь должно быть допустимо, но для каждого статуса по-своему
    eosio::check(false, "Заявка находится в недопустимом статусе для отмены");
  }

  // Удаляем сегменты, если они существуют
  marketplace::delete_segments_by_request(coopname, change.id);
}



