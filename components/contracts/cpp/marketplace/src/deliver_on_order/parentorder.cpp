/**
\ingroup public_actions
\brief Создать родительскую заявку на денежный паевой взнос.
*
* Данный метод позволяет пользователю создать родительскую заявку на денежный паевой взнос.
*
* @param coopname Имя кооператива
* @param username Имя пользователя, инициирующего заявку
* @param units Количество частей (штук) товара или услуги
* @param unit_cost Цена за единицу (штуку) товара или услуги
* @param membership_fee_amount Сумма членского взноса
* @param cancellation_fee_amount Сумма комиссии за отмену заявки
* @param braname Имя кооперативного участка откуда будет забираться товар
* @param document Сопутствующий подписанный документ на взнос или возврат взноса
* @param meta Метаданные о заявке
*
* @note Авторизация требуется от аккаунта: @p coopname
*/
[[eosio::action]] void marketplace::parentorder(eosio::name coopname, eosio::name braname, eosio::name username, uint64_t units, eosio::asset unit_cost, eosio::asset membership_fee_amount, eosio::asset cancellation_fee_amount, std::string meta) {
  require_auth(coopname);

  cooperatives2_index coops(_registrator, _registrator.value);
  auto coop = coops.find(coopname.value);
  eosio::check(coop != coops.end() && coop -> is_coop(), "Кооператив не найден");
  eosio::check(unit_cost.symbol == coop -> initial.symbol, "Неверный символ токена");
  eosio::check(membership_fee_amount.symbol == coop -> initial.symbol, "Неверный символ токена для членского взноса");
  eosio::check(cancellation_fee_amount.symbol == coop -> initial.symbol, "Неверный символ токена для комиссии отмены");
  eosio::check(units > 0, "Количество единиц в заявке должно быть больше нуля");
  eosio::check(unit_cost.amount >= 0, "Цена не может быть отрицательной");
  eosio::check(membership_fee_amount.amount >= 0, "Членский взнос не может быть отрицательным");
  eosio::check(cancellation_fee_amount.amount >= 0, "Комиссия за отмену не может быть отрицательной");

  // Проверяем существование кооперативного участка
  get_branch_or_fail(coopname, braname);

  requests_index requests(_marketplace, coopname.value);
  uint64_t id = get_global_id(_marketplace, "requests"_n);
    
  participants_index participants(_soviet, coopname.value);
  auto participant = participants.find(username.value);      
  eosio::check(participant != participants.end(), "Вы не являетесь членом указанного кооператива");

  auto program = get_program_or_fail(coopname, _marketplace_program_id);

  // Для заказа рассчитываем общую стоимость включая членский взнос
  eosio::asset supplier_amount = unit_cost * units;
  eosio::asset total_cost = supplier_amount + membership_fee_amount;
  
  // Проверяем что комиссия за отмену не превышает общую стоимость
  eosio::check(cancellation_fee_amount <= total_cost, "Комиссия за отмену не может превышать общую стоимость заказа");
  
  // Блокируем средства для заказа включая членский взнос
  std::string memo = "Создание заказа по программе №" + std::to_string(_marketplace_program_id) + " с ID: " + std::to_string(id);
  Wallet::block_funds(_marketplace, coopname, username, total_cost, _marketplace_program, memo);

  requests.emplace(_marketplace, [&](auto &i) {
    i.id = id;
    i.type = "order"_n;
    i.username = username;
    i.coopname = coopname;
    i.status = "active"_n;
    i.remain_units = units;
    i.unit_cost = unit_cost;
    i.supplier_amount = supplier_amount;
    i.total_cost = total_cost;
    i.membership_fee_amount = membership_fee_amount;
    i.product_lifecycle_secs = 0; // Не используется для заказов
    i.meta = meta;
    i.created_at = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());
    i.cancellation_fee_amount = cancellation_fee_amount;
    i.braname = braname;
  });
  
}; 