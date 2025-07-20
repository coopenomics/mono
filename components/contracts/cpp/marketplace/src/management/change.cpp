// /**
//  * @mainpage Описание системы заявок
//  *
//  * В системе имеются два типа заявок: order (заказ) и offer (предложение), а также два уровня заявок: родительская (base) и встречная (quote).
//  * Используется одна таблица заявок: exchange(_marketplace, _marketplace). Встречная заявка всегда должна быть противополжного типа к родительской.
//  *
//  * <b>Группы заявок:</b>
//  * 
//  * <b>1. Группа предложений от родителя:</b>
//  * - Parent: type == 'offer' && (parent_id == 0) => имущественный паевый взнос
//  * - Child: type == 'order' && (parent_id > 0) => денежный паевый взнос
//  *
//  * <b>2. Группа заказа от родителя:</b>
//  * - Parent: type == "order" && (parent_id == 0) => денежный паевый взнос
//  * - Child: type == "offer" && (parent_id > 0) => имущественный паевый взнос
//  *
//  * <b>Обозначения:</b>
//  * - order => денежный паевый взнос
//  * - offer => имущественный паевый взнос
//  */

/**
 * @brief Создание заявки на обмен
 * 
 * @param type Тип заявки
 * @param params Параметры заявки
 * 
 * Общая функция для создания как родительских, так и дочерних заявок.
 */
void marketplace::create (eosio::name type, const exchange_params& params) {
  cooperatives2_index coops(_registrator, _registrator.value);
  auto coop = coops.find(params.coopname.value);
  eosio::check(coop != coops.end() && coop -> is_coop(), "Кооператив не найден");
  eosio::check(params.unit_cost.symbol == coop -> initial.symbol, "Неверный символ токен");
  eosio::check(params.units > 0, "Количество единиц в заявке должно быть больше нуля");
  eosio::check(params.unit_cost.amount >= 0, "Цена не может быть отрицательной");

  if (params.parent_id == 0) {
    marketplace::create_parent(type, params);
  } else {
    marketplace::create_child(type, params);
  };
};

/**
 * @brief Создание родительской заявки
 * 
 * @param type Тип заявки
 * @param params Параметры заявки
 * 
 * Специализированная функция для создания родительской заявки.
 */
void marketplace::create_parent(eosio::name type, const exchange_params& params) {
  eosio::check(type == "offer"_n, "В родительском заявке может быть только предложение");

  requests_index exchange(_marketplace, params.coopname.value);
  uint64_t id = get_global_id(_marketplace, "exchange"_n);
  
  eosio::check(params.parent_id == 0, "Родительская заявка создаётся без указания родителя");

  cooperatives2_index coops(_registrator, _registrator.value);
  auto coop = coops.find(params.coopname.value);
  eosio::check(coop != coops.end(), "Кооператив не найден");
  eosio::check(coop -> is_coop() == true, "Организация - не кооператив");
    
  participants_index participants(_soviet, params.coopname.value);
  auto participant = participants.find(params.username.value);      
  eosio::check(participant != participants.end(), "Вы не являетесь членом указанного кооператива");

  auto program = get_program_or_fail(params.coopname, params.program_id);

  //срок гарантийного возврата должен быть установлен
  eosio::check(params.product_lifecycle_secs > 0, "Гарантийный срок возврата для имущества должен быть установлен");

  exchange.emplace(_marketplace, [&](auto &i) {
    i.id = id;
    i.type = type;
    i.program_id = params.program_id; 
    i.username = params.username;
    i.coopname = params.coopname;
    i.status = "moderation"_n;
    i.remain_units = params.units;
    i.unit_cost = params.unit_cost;
    i.supplier_amount = params.unit_cost * params.units;

    i.membership_fee = asset(0, coop -> initial.symbol);
    i.total_cost = asset(0, coop -> initial.symbol);
    
    i.product_lifecycle_secs = params.product_lifecycle_secs;
    i.data = params.data;
    i.meta = params.meta;
    i.created_at = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());
    i.cancellation_fee_amount = asset(0, params.unit_cost.symbol);
  });
  
  action(
    permission_level{ _marketplace, "active"_n},
    _marketplace,
    "newid"_n,
    std::make_tuple(id, type)
  ).send();
};

/**
 * @brief Создание дочерней заявки
 * 
 * @param type Тип заявки
 * @param params Параметры заявки
 * 
 * Специализированная функция для создания дочерних заявок, связанных с родительской заявкой.
 */
void marketplace::create_child(eosio::name type, const exchange_params& params) {
  eosio::check(type == "order"_n, "В дочерней заявки может быть только заказ");

  requests_index exchange(_marketplace, params.coopname.value);
  auto parent_change = exchange.find(params.parent_id);
  eosio::check(parent_change != exchange.end(), "Заявка не обнаружена");
  eosio::check(parent_change -> status == "published"_n, "Заявка не опубликована или не прошла модерацию");

  cooperatives2_index coops(_registrator, _registrator.value);
  auto coop = coops.find(params.coopname.value);
  eosio::check(coop != coops.end(), "Кооператив не найден");
  eosio::check(coop -> is_coop() == true, "Организация - не кооператив");
  
  eosio::check(parent_change -> unit_cost.amount == params.unit_cost.amount, "Торги запрещены");
  
  eosio::check(params.parent_id > 0, "Встречная заявка создаётся с указанием родителя");
  eosio::check(params.document.has_value(), "Документ должен быть приложен к транзакции");
  
  //проводим проверку подписи документа
  verify_document_or_fail(*params.document);

  uint64_t id = get_global_id(_marketplace, "exchange"_n);
  
  auto program = get_program_or_fail(params.coopname, params.program_id);

  eosio::check(parent_change -> program_id == params.program_id, "Целевые программы должны совпадать");

  participants_index participants(_soviet, params.coopname.value);
  auto participant = participants.find(params.username.value);      
  eosio::check(participant != participants.end(), "Вы не являетесь членом указанного кооператива");
  
  uint64_t product_lifecycle_secs = 0;

  eosio::asset membership_fee;
  eosio::asset supplier_amount = params.unit_cost * params.units;

  if (program.calculation_type == "absolute"_n) {
    membership_fee = program.fixed_membership_contribution;
  } else if (program.calculation_type == "relative"_n) {
    membership_fee = supplier_amount * HUNDR_PERCENTS / program.membership_percent_fee;
  } else if (program.calculation_type == "free"_n) {
    membership_fee = asset(0, _root_govern_symbol);
  };
  
  eosio::asset total_cost = params.unit_cost * params.units + membership_fee;
  
  //Специальные проверки
  if (type == "offer"_n) {
    //родительская заявка должна быть противоположного типа
    eosio::check(parent_change -> type == "order"_n, "Неверный тип родительской заявки");

  } else if(type == "order"_n) {
    //родительская заявка должна быть противоположного типа
    eosio::check(parent_change -> type == "offer"_n, "Неверный тип родительской заявки");
    
    std::string memo = "Начало поставки по программе №" + std::to_string(params.program_id) + " с ID: " + std::to_string(id);

    //Для блокировки средств необходимо их иметь на ЦПП, т.е. предварительно необходимо сконвертировать их с ЦПП кошелька
    action(
      permission_level{ _marketplace, "active"_n},
      _soviet,
      "blockbal"_n,
      std::make_tuple(params.coopname, params.username, params.program_id, total_cost, memo)
    ).send();
    
  }
  
  exchange.emplace(_marketplace, [&](auto &i) {
    i.id = id;
    i.parent_id = params.parent_id;
    i.parent_username = parent_change -> username;
    i.type = type; 
    i.program_id = parent_change -> program_id;
    i.coopname = params.coopname;
    i.username = params.username;
    i.status = "published"_n;
    i.remain_units = params.units;
    i.unit_cost = params.unit_cost;
    i.membership_fee = membership_fee;
    
    i.supplier_amount = supplier_amount;
    i.total_cost = total_cost;
    
    i.created_at = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());
    i.cancellation_fee_amount = asset(0, params.unit_cost.symbol);

    if (type == "order"_n) {
      i.money_contributor = params.username;
      i.product_contributor = parent_change -> username;
      i.product_lifecycle_secs = parent_change -> product_lifecycle_secs;
    } else if (type == "offer"_n) {
      i.money_contributor = parent_change -> username;
      i.product_contributor = params.username;  
      i.product_lifecycle_secs = params.product_lifecycle_secs;
    };
  });

  action(
    permission_level{ _marketplace, "active"_n},
    _marketplace,
    "newid"_n,
    std::make_tuple(id, type)
  ).send();
};

/**
 * @brief Отмена родительской заявки.
 */
void marketplace::cancel_parent(eosio::name coopname, eosio::name username, uint64_t exchange_id) {
  requests_index exchange(_marketplace, coopname.value);
  auto change = exchange.find(exchange_id);

  //Удаление, если заблокированных объектов на поставке - нет.   
  eosio::check(change -> remain_units + change -> blocked_units == 0, "Заявка не может быть отменена из-за наличия заблокированных единиц товара");
  exchange.erase(change);
};

/**
 * @brief Отмена дочерней заявки.
 */
void marketplace::cancel_child(eosio::name coopname, eosio::name username, uint64_t exchange_id) {
  requests_index exchange(_marketplace, coopname.value);
  auto change = exchange.find(exchange_id);
  auto parent_change = exchange.find(change -> parent_id);
  eosio::asset quantity = change -> unit_cost * change -> blocked_units;

  // оповещаем совет об отмене и разблокируем средства
  if (change -> type == "order"_n) {
    std::string memo = "Отмена поставки по программе №" + std::to_string(change -> program_id) + " с ID: " + std::to_string(change -> id);

    action(
      permission_level{ _marketplace, "active"_n},
      _soviet,
      "unblockbal"_n,
      std::make_tuple(coopname, change -> money_contributor, change -> program_id, change -> total_cost, memo)
    ).send();
  };  

  if (change -> status == "authorized"_n || change -> status == "accepted"_n) {
    //возвращаем единицы товара в родительскую заявку для статусов с заблокированными единицами
    if (change -> blocked_units > 0) {
      exchange.modify(parent_change, _marketplace, [&](auto &e) {
        e.remain_units += change -> blocked_units;
        e.blocked_units -= change -> blocked_units;
        e.supplier_amount = e.remain_units * e.unit_cost;
      });
    }

    exchange.modify(change, _marketplace, [&](auto &c){
      c.status = "canceled"_n;
      c.canceled_at = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());
      c.blocked_units = 0; // Обнуляем заблокированные единицы
    });

  } else if (change -> status == "published"_n) {

    exchange.modify(change, _marketplace, [&](auto &c){
      c.status = "canceled"_n;
      c.canceled_at = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());
    });

  } else {
    //TODO здесь должно быть допустимо, но для каждого статуса по-своему
    eosio::check(false, "Заявка находится в недопустимом статусе для отмены");
  }

  // Удаляем сегменты, если они существуют
  marketplace::delete_segments_by_request(coopname, exchange_id);
}






