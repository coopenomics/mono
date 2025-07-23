/**
\ingroup public_actions
\brief Отклонение принятия заявки советом (declineacc).

@details Данный метод вызывается советом когда заявление на конвертацию, возврат или взнос отклоняется.
При отклонении отменяется дочерняя заявка, а родительская отменяется только если количество единиц товара равно.

@param coopname Имя кооператива
@param request_hash Хэш заявки, которая должна быть отменена
@param reason Причина отклонения

@note Авторизация требуется от аккаунта: @p _soviet
*/
[[eosio::action]] void marketplace::declineacc(eosio::name coopname, checksum256 request_hash, std::string reason) {
  require_auth(_soviet);
  
  requests_index requests(_marketplace, coopname.value);
  auto change_opt = Marketplace::get_request_by_hash(coopname, request_hash);
  
  // Если заявка не найдена, ничего не делаем (возможно уже удалена)
  if (!change_opt.has_value()) {
    print("Заявка уже удалена или не найдена. Кооператив: ", coopname, ", причина: ", reason);
    return;
  }
  
  auto change = change_opt.value();
  
  // Логирование отклонения
  print("Отклонение заявления советом. Заявка ID: ", change.id, ", причина: ", reason);
  
  // Если это дочерняя заявка, отменяем её и проверяем нужно ли отменять родительскую
  if (change.parent_id > 0) {
    decline_child_request(coopname, change);
  } else {
    // Если это родительская заявка, ищем все дочерние и отменяем их
    decline_parent_and_children(coopname, change);
  }
}

/**
 * @brief Отмена дочерней заявки при отклонении с проверкой равенства единиц
 */
void marketplace::decline_child_request(eosio::name coopname, const request& child_change) {
  requests_index requests(_marketplace, coopname.value);
  
  // Проверяем, что заявка все еще существует
  auto child_itr = requests.find(child_change.id);
  if (child_itr == requests.end()) {
    return; // Заявка уже удалена
  }
  
  // Разблокируем средства если это заказ
  if (child_change.type == "order"_n && child_change.total_cost.amount > 0) {
    std::string memo = "Отклонение заявления советом по программе №" + std::to_string(_marketplace_program_id) + " с ID: " + std::to_string(child_change.id);
    
    Wallet::unblock_funds(_marketplace, coopname, child_change.money_contributor, child_change.total_cost, _marketplace_program, memo);
  }
  
  // Получаем родительскую заявку
  auto parent_change_opt = Marketplace::get_request_by_hash(coopname, child_change.parent_hash);
  bool should_cancel_parent = false;
  
  if (parent_change_opt.has_value()) {
    auto parent_itr = requests.find(parent_change_opt.value().id);
    if (parent_itr != requests.end()) {
      // Возвращаем заблокированные единицы в родительскую заявку
      if (child_change.blocked_units > 0) {
        requests.modify(parent_itr, _marketplace, [&](auto &e) {
          e.remain_units += child_change.blocked_units;
          e.blocked_units -= child_change.blocked_units;
          e.supplier_amount = e.remain_units * e.unit_cost;
        });
        
        // Получаем обновленную родительскую заявку для проверки единиц
        auto updated_parent = requests.find(parent_change_opt.value().id);
        
        // Проверяем равенство количества единиц для определения стратегии удаления
        // Сравниваем remain_units дочерней заявки с remain_units обновленной родительской
        bool units_equal = (child_change.remain_units == updated_parent->remain_units);
        
        if (units_equal) {
          // Если количество единиц равно - отмечаем для удаления родительской заявки
          should_cancel_parent = true;
        }
      } else {
        // Если заблокированных единиц нет, сравниваем remain_units как есть
        bool units_equal = (child_change.remain_units == parent_itr->remain_units);
        if (units_equal) {
          should_cancel_parent = true;
        }
      }
    }
  }
  
  // Удаляем сегменты дочерней заявки
  marketplace::delete_segments_by_request(coopname, child_change.id);
  
  // Удаляем дочернюю заявку
  requests.erase(child_itr);
  
  // Удаляем родительскую заявку если количество единиц равно
  if (should_cancel_parent && parent_change_opt.has_value()) {
    auto parent_itr = requests.find(parent_change_opt.value().id);
    if (parent_itr != requests.end()) {
      // Если это родительский заказ, разблокируем средства
      if (parent_change_opt.value().type == "order"_n && parent_change_opt.value().total_cost.amount > 0 && parent_change_opt.value().parent_id == 0) {
        std::string memo = "Отклонение заявления советом по программе №" + std::to_string(_marketplace_program_id) + " с ID: " + std::to_string(parent_change_opt.value().id);
        
        Wallet::unblock_funds(_marketplace, coopname, parent_change_opt.value().username, parent_change_opt.value().total_cost, _marketplace_program, memo);
      }
      
      requests.erase(parent_itr);
    }
  }
}

/**
 * @brief Отмена родительской заявки при отклонении
 */
void marketplace::decline_parent_request(eosio::name coopname, const request& parent_change) {
  requests_index requests(_marketplace, coopname.value);
  
  // Проверяем, что заявка все еще существует
  auto parent_itr = requests.find(parent_change.id);
  if (parent_itr == requests.end()) {
    return; // Заявка уже удалена
  }
  
  // Разблокируем средства если это родительский заказ
  if (parent_change.type == "order"_n && parent_change.total_cost.amount > 0 && parent_change.parent_id == 0) {
    std::string memo = "Отклонение заявления советом по программе №" + std::to_string(_marketplace_program_id) + " с ID: " + std::to_string(parent_change.id);
    
    Wallet::unblock_funds(_marketplace, coopname, parent_change.username, parent_change.total_cost, _marketplace_program, memo);
  }
  
  // Удаляем родительскую заявку
  requests.erase(parent_itr);
}

/**
 * @brief Отмена родительской заявки и всех её дочерних заявок
 */
void marketplace::decline_parent_and_children(eosio::name coopname, const request& parent_change) {
  requests_index requests(_marketplace, coopname.value);
  
  // Ищем все дочерние заявки и отменяем их
  auto parent_index = requests.get_index<"byparent"_n>();
  auto children_begin = parent_index.lower_bound(parent_change.id);
  auto children_end = parent_index.upper_bound(parent_change.id);
  
  // Сначала отменяем всех детей
  std::vector<uint64_t> children_to_cancel;
  for (auto itr = children_begin; itr != children_end; ++itr) {
    children_to_cancel.push_back(itr->id);
  }
  
  for (uint64_t child_id : children_to_cancel) {
    auto child_itr = requests.find(child_id);
    if (child_itr != requests.end()) {
      // Для дочерних заявок используем упрощенную логику без проверки единиц
      // так как мы отменяем родительскую заявку в любом случае
      decline_child_simple(coopname, *child_itr);
    }
  }
  
  // Затем отменяем родительскую заявку
  decline_parent_request(coopname, parent_change);
}

/**
 * @brief Упрощенная отмена дочерней заявки без проверки единиц (используется при отмене родительской)
 */
void marketplace::decline_child_simple(eosio::name coopname, const request& child_change) {
  requests_index requests(_marketplace, coopname.value);
  
  // Проверяем, что заявка все еще существует
  auto child_itr = requests.find(child_change.id);
  if (child_itr == requests.end()) {
    return; // Заявка уже удалена
  }
  
  // Разблокируем средства если это заказ
  if (child_change.type == "order"_n && child_change.total_cost.amount > 0) {
    std::string memo = "Отклонение заявления советом по программе №" + std::to_string(_marketplace_program_id) + " с ID: " + std::to_string(child_change.id);
    
    Wallet::unblock_funds(_marketplace, coopname, child_change.money_contributor, child_change.total_cost, _marketplace_program, memo);
  }
  
  // Удаляем сегменты дочерней заявки
  marketplace::delete_segments_by_request(coopname, child_change.id);
  
  // Удаляем дочернюю заявку
  requests.erase(child_itr);
} 