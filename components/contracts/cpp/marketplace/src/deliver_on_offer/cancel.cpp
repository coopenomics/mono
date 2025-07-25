/**
\ingroup public_actions
\brief Отмена заявки с учетом комиссии за отмену.

@details Позволяет пользователю отменить родительскую или дочернюю заявку с учетом следующих правил:
- Поставщик не может отменить заявку после поставки имущества (статусы supplied1+)
- Заказчик может отменить с вычетом комиссии за отмену (cancellation_fee_amount)
- При отмене возвращаются заблокированные единицы и средства

@param coopname Имя кооператива
@param username Имя пользователя, инициирующего отмену
@param request_hash Хэш заявки для отмены

@note Авторизация требуется от аккаунта: @p coopname
*/
[[eosio::action]] void marketplace::cancel(eosio::name coopname, eosio::name username, checksum256 request_hash) { 
  require_auth(coopname);
  
  requests_index requests(_marketplace, coopname.value);
  auto change_opt = Marketplace::get_request_by_hash(coopname, request_hash);
  eosio::check(change_opt.has_value(), "Заявка не найдена");
  auto change = change_opt.value();
  
  // Проверяем права доступа на отмену заявки
  eosio::check(change.username == username, "Только владелец заявки может её отменить");
  
  // Проверяем что заявка может быть отменена
  eosio::check(change.status != "completed"_n && change.status != "canceled"_n && change.status != "declined"_n, 
               "Заявка уже завершена или отменена");

  if (change.parent_id == 0) {
    marketplace::cancel_parent(coopname, username, request_hash);
  } else {
    marketplace::cancel_child(coopname, username, request_hash);
  }
}

/**
 * @brief Отмена родительской заявки.
 */
void marketplace::cancel_parent(eosio::name coopname, eosio::name username, checksum256 request_hash) {
  requests_index requests(_marketplace, coopname.value);
  auto change_opt = Marketplace::get_request_by_hash(coopname, request_hash);
  eosio::check(change_opt.has_value(), "Заявка не найдена");
  auto change = change_opt.value();

  // Родительская заявка может быть отменена только если нет заблокированных единиц
  eosio::check(change.blocked_units == 0, "Заявка не может быть отменена из-за наличия заблокированных единиц товара");
  
  // Для родительского заказа разблокируем средства
  if (change.type == "order"_n && change.total_cost.amount > 0) {
    eosio::asset refund_amount = change.total_cost;
    
    // Если заказчик отменяет заявку, вычитаем комиссию за отмену
    if (change.money_contributor == username && change.cancellation_fee_amount.amount > 0) {
      refund_amount -= change.cancellation_fee_amount;
    }
    
    std::string memo = "Отмена родительской заявки по программе №" + std::to_string(_marketplace_program_id) + " с ID: " + std::to_string(change.id);
    
    if (refund_amount.amount > 0) {
      // Списываем средства с ЦПП маркетплейса
      Wallet::sub_blocked_funds(_marketplace, coopname, change.money_contributor, refund_amount, _marketplace_program, memo);
      // Начисляем средства на ЦПП Цифровой Кошелёк
      Wallet::add_available_funds(_marketplace, coopname, change.money_contributor, refund_amount, _wallet_program, memo);
    }
    
    // Если была комиссия, списываем её и направляем в фонд членских взносов
    if (change.money_contributor == username && change.cancellation_fee_amount.amount > 0) {
      std::string fee_memo = "Комиссия за отмену родительской заявки по программе №" + std::to_string(_marketplace_program_id) + " с ID: " + std::to_string(change.id);
      
      // Списываем комиссию с ЦПП маркетплейса
      Wallet::sub_blocked_funds(_marketplace, coopname, change.money_contributor, change.cancellation_fee_amount, _marketplace_program, fee_memo);
      
      // Направляем комиссию в фонд членских взносов
      Wallet::add_member_fee(_marketplace, coopname, username, _marketplace_program_id, change.cancellation_fee_amount, fee_memo);
    }
  }
  
  // Удаляем сегменты родительской заявки
  marketplace::delete_segments_by_request(coopname, change.id);
  
  auto change_itr = requests.find(change.id);
  eosio::check(change_itr != requests.end(), "Заявка не найдена для удаления");
  requests.erase(change_itr);
}

/**
 * @brief Отмена дочерней заявки с учетом комиссии за отмену.
 */
void marketplace::cancel_child(eosio::name coopname, eosio::name username, checksum256 request_hash) {
  requests_index requests(_marketplace, coopname.value);
  auto change_opt = Marketplace::get_request_by_hash(coopname, request_hash);
  eosio::check(change_opt.has_value(), "Заявка не найдена");
  auto change = change_opt.value();
  
  auto parent_change_opt = Marketplace::get_request_by_hash(coopname, change.parent_hash);
  eosio::check(parent_change_opt.has_value(), "Родительская заявка не найдена");
  auto parent_change = parent_change_opt.value();

  // Проверяем права на отмену в зависимости от типа заявки и статуса
  if (change.type == "offer"_n) {
    // Поставщик не может отменить заявку после поставки имущества
    eosio::check(change.status != "supplied1"_n && change.status != "supplied2"_n && 
                 change.status != "delivered"_n && change.status != "received1"_n && 
                 change.status != "received2"_n,
                 "Поставщик не может отменить заявку после поставки имущества");
  }

  // Возвращаем заблокированные единицы в родительскую заявку
  if (change.blocked_units > 0) {
    auto parent_itr = requests.find(parent_change.id);
    eosio::check(parent_itr != requests.end(), "Родительская заявка не найдена для обновления");
    requests.modify(parent_itr, _marketplace, [&](auto &e) {
      e.remaining_units += change.blocked_units;
      e.blocked_units -= change.blocked_units;
      e.base_cost = e.remaining_units * e.unit_cost;
    });
  }

  // Разблокируем средства если это заказ
  if (change.type == "order"_n && change.total_cost.amount > 0) {
    eosio::asset refund_amount = change.total_cost;
    
    // Если заказчик отменяет заявку, вычитаем комиссию за отмену
    if (change.money_contributor == username && change.cancellation_fee_amount.amount > 0) {
      refund_amount -= change.cancellation_fee_amount;
    }
    
    std::string memo = "Отмена заявки по программе №" + std::to_string(_marketplace_program_id) + " с ID: " + std::to_string(change.id);
    
    if (refund_amount.amount > 0) {
      // Списываем средства с ЦПП маркетплейса
      Wallet::sub_blocked_funds(_marketplace, coopname, change.money_contributor, refund_amount, _marketplace_program, memo);
      // Начисляем средства на ЦПП Цифровой Кошелёк
      Wallet::add_available_funds(_marketplace, coopname, change.money_contributor, refund_amount, _wallet_program, memo);
    }
    
    // Если была комиссия, списываем её и направляем в фонд членских взносов
    if (change.money_contributor == username && change.cancellation_fee_amount.amount > 0) {
      std::string fee_memo = "Комиссия за отмену заявки по программе №" + std::to_string(_marketplace_program_id) + " с ID: " + std::to_string(change.id);
      
      // Списываем комиссию с ЦПП маркетплейса
      Wallet::sub_blocked_funds(_marketplace, coopname, change.money_contributor, change.cancellation_fee_amount, _marketplace_program, fee_memo);
      
      // Направляем комиссию в фонд членских взносов
      Wallet::add_member_fee(_marketplace, coopname, username, _marketplace_program_id, change.cancellation_fee_amount, fee_memo);
    }
  }

  // Удаляем сегменты дочерней заявки
  marketplace::delete_segments_by_request(coopname, change.id);
  
  // Проверяем равенство количества единиц для определения стратегии удаления
  auto updated_parent = requests.find(parent_change.id);
  bool units_equal = false;
  
  if (updated_parent != requests.end()) {
    units_equal = (change.remaining_units == updated_parent->remaining_units);
  }

  // Удаляем дочернюю заявку
  auto change_itr = requests.find(change.id);
  eosio::check(change_itr != requests.end(), "Заявка не найдена для удаления");
  requests.erase(change_itr);

  // Если количество единиц равно - удаляем также родительскую заявку
  if (units_equal && updated_parent != requests.end()) {
    // Для родительского заказа тоже разблокируем средства если есть
    if (parent_change.type == "order"_n && parent_change.total_cost.amount > 0 && parent_change.parent_id == 0) {
      eosio::asset parent_refund_amount = parent_change.total_cost;
      
      // Если заказчик отменяет заявку, вычитаем комиссию за отмену
      if (parent_change.money_contributor == username && parent_change.cancellation_fee_amount.amount > 0) {
        parent_refund_amount -= parent_change.cancellation_fee_amount;
      }
      
      std::string parent_memo = "Отмена родительской заявки при отмене дочерней с равными единицами по программе №" + std::to_string(_marketplace_program_id) + " с ID: " + std::to_string(parent_change.id);
      
      if (parent_refund_amount.amount > 0) {
        // Списываем средства с ЦПП маркетплейса
        Wallet::sub_blocked_funds(_marketplace, coopname, parent_change.money_contributor, parent_refund_amount, _marketplace_program, parent_memo);
        // Начисляем средства на ЦПП Цифровой Кошелёк
        Wallet::add_available_funds(_marketplace, coopname, parent_change.money_contributor, parent_refund_amount, _wallet_program, parent_memo);
      }
      
      // Если была комиссия, списываем её и направляем в фонд членских взносов
      if (parent_change.money_contributor == username && parent_change.cancellation_fee_amount.amount > 0) {
        std::string parent_fee_memo = "Комиссия за отмену родительской заявки при отмене дочерней по программе №" + std::to_string(_marketplace_program_id) + " с ID: " + std::to_string(parent_change.id);
        
        // Списываем комиссию с ЦПП маркетплейса
        Wallet::sub_blocked_funds(_marketplace, coopname, parent_change.money_contributor, parent_change.cancellation_fee_amount, _marketplace_program, parent_fee_memo);
        
        // Направляем комиссию в фонд членских взносов
        Wallet::add_member_fee(_marketplace, coopname, username, _marketplace_program_id, parent_change.cancellation_fee_amount, parent_fee_memo);
      }
    }
    
    // Удаляем сегменты родительской заявки
    marketplace::delete_segments_by_request(coopname, parent_change.id);
    
    requests.erase(updated_parent);
  }
}



