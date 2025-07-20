/**
\ingroup public_actions
\brief Подписание акта о приёме-передаче имущества.

* @details После успешного получения товара, получатель подписывает акт о приёме-передаче, что свидетельствует о юридическом завершении сделки. Этот акт делает пакет документов по данной сделке полным. После проведения ряда проверок, обновляются статусы и количество объектов в основной заявке и предложении. Если все объекты основной заявки обработаны, заявка удаляется из публикации. В зависимости от типа предложения, может осуществляться перевод токенов.

* @param username Имя пользователя-получателя товара.
* @param exchange_id ID предложения, под которым следует подписать акт.

* @note Авторизация требуется от аккаунта: @p username
*/
[[eosio::action]] void marketplace::complete(eosio::name coopname, eosio::name username, uint64_t exchange_id) { 
  require_auth(coopname);
      
  requests_index exchange(_marketplace, coopname.value);
  auto change = exchange.find(exchange_id);
  eosio::check(change != exchange.end(), "Заявка не найдена");
  
  eosio::check(change -> parent_id > 0, "У указанной заявки нет встречной заявки");

  auto parent_change = exchange.find(change -> parent_id);
  eosio::check(parent_change != exchange.end(), "Родительская заявка не найдена");
  
  // eosio::check(change -> username == username, "Вы не можете подтвердить исполнение заявки");
  eosio::check(change -> status == "recieved2"_n, "Заявка находится в неверном статусе для утверждения обмена");
  
  eosio::check(change -> warranty_delay_until.sec_since_epoch() < eosio::current_time_point().sec_since_epoch(), "Время гарантийной задержки еще не истекло");

  exchange.modify(parent_change, _marketplace, [&](auto &i) {
    i.delivered_units += change -> blocked_units;
    i.blocked_units -= change -> blocked_units; 
    
    if (i.blocked_units + parent_change -> remain_units == 0) {
      i.status = "unpublished"_n; //снимаем родительскую заявку с публикации, если она исполнена
    }; 
  });

  // Проверяем инварианты родительской заявки
  auto updated_parent = exchange.find(change -> parent_id);
  marketplace::check_units_invariant(*updated_parent, "complete_parent_update");

  exchange.modify(change, _marketplace, [&](auto &o) {
    o.status = "completed"_n;
    o.delivered_units += change -> blocked_units;
    o.blocked_units = 0;
    o.completed_at = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());
  });
  
  // Проверяем инварианты дочерней заявки перед удалением
  auto updated_change = exchange.find(exchange_id);
  marketplace::check_units_invariant(*updated_change, "complete_child_before_delete");

  auto program = get_program_or_fail(coopname, change -> program_id);

  std::string memo = "Успешное завершение поставки имущества по программе №" + std::to_string(change -> program_id) + " с ID: " + std::to_string(change -> id);

  //Заказчику разблокируем баланс ЦПП кооплекса и списываем его  
  action(
    permission_level{ _marketplace, "active"_n},
    _soviet,
    "unblockbal"_n,
    std::make_tuple(coopname, change -> money_contributor, change -> program_id, change -> total_cost, memo)
  ).send();

  action(
    permission_level{ _marketplace, "active"_n},
    _soviet,
    "subbal"_n,
    std::make_tuple(coopname, change -> money_contributor, change -> program_id, change -> total_cost, false, memo)
  ).send();
  
  
  //Поставщику разблокируем средства в программе кооплейса
  action(
    permission_level{ _marketplace, "active"_n},
    _soviet,
    "unblockbal"_n,
    std::make_tuple(coopname, change -> product_contributor, change -> program_id, change -> supplier_amount, memo)
  ).send();


  if (change -> membership_fee.amount > 0) {
    //распределяем членские взносы по фондам
    action(
      permission_level{ _marketplace, "active"_n},
      _fund,
      "spreadamount"_n,
      std::make_tuple(coopname, change -> membership_fee)
    ).send();
    
    // отмечаем распределение членских взносов в программе и кошельке пользователя
    action(
      permission_level{ _marketplace, "active"_n},
      _soviet,
      "addmemberfee"_n,
      std::make_tuple(coopname, change -> money_contributor, change -> program_id, change -> membership_fee, memo)
    ).send();     
  }

  // Удаляем сегменты встречной заявки
  marketplace::delete_segments_by_request(coopname, exchange_id);
  
  // Удаляем встречную заявку
  exchange.erase(change);
}
