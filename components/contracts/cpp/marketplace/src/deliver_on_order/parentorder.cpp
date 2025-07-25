/**
\ingroup public_actions
\brief Создать родительскую заявку на денежный паевой взнос.
*
* Данный метод позволяет пользователю создать родительскую заявку на денежный паевой взнос.
*
* @param coopname Имя кооператива
* @param username Имя пользователя, инициирующего заявку
* @param hash Хэш заявки (уникальный идентификатор)
* @param units Количество частей (штук) товара или услуги
* @param unit_cost Цена за единицу (штуку) товара или услуги
* @param membership_fee_amount Сумма членского взноса
* @param cancellation_fee_amount Сумма комиссии за отмену заявки
* @param braname Имя кооперативного участка откуда будет забираться товар
* @param convert_in Заявление на конвертацию из кошелька в маркетплейс
* @param meta Метаданные о заявке
*
* @note Авторизация требуется от аккаунта: @p coopname
*/
[[eosio::action]] void marketplace::parentorder(eosio::name coopname, eosio::name braname, eosio::name username, checksum256 hash, uint64_t units, eosio::asset unit_cost, eosio::asset membership_fee_amount, eosio::asset cancellation_fee_amount, document2 convert_in, std::string meta) {
  require_auth(coopname);

  // Проверяем, что заявка с таким хэшем не существует
  auto existing_request = get_request_by_hash(coopname, hash);
  eosio::check(!existing_request.has_value(), "Заявка с таким хэшем уже существует");

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
  uint64_t request_id = get_global_id(_marketplace, "requests"_n);
    
  participants_index participants(_soviet, coopname.value);
  auto participant = participants.find(username.value);      
  eosio::check(participant != participants.end(), "Вы не являетесь членом указанного кооператива");

  auto program = get_program_or_fail(coopname, _marketplace_program_id);

  // Для заказа рассчитываем общую стоимость включая членский взнос
  eosio::asset base_cost = unit_cost * units;
  eosio::asset total_cost = base_cost + membership_fee_amount;
  
  // Проверяем что комиссия за отмену не превышает общую стоимость
  eosio::check(cancellation_fee_amount <= total_cost, "Комиссия за отмену не может превышать общую стоимость заказа");
  
  // Проверяем подпись документа на конвертацию
  verify_document_or_fail(convert_in);
  
  requests.emplace(_marketplace, [&](auto &i) {
    i.id = request_id;
    i.hash = hash;
    i.type = "order"_n;
    i.username = username;
    i.coopname = coopname;
    i.status = "active"_n;
    i.remaining_units = units;
    i.unit_cost = unit_cost;
    i.base_cost = base_cost;
    i.total_cost = total_cost;
    i.membership_fee_amount = membership_fee_amount;
    i.product_lifecycle_secs = 0; // Не используется для заказов
    i.meta = meta;
    i.created_at = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());
    i.cancellation_fee_amount = cancellation_fee_amount;
    i.braname = braname;
  });
  
  // Создаем сегмент для родительской заявки поставки из кооператива - заказчику
  marketplace::create_segment(coopname, request_id, marketplace::valid_segment("c2r"), username);
  
  // Сохраняем заявление на конвертацию в contribute сегменте
  marketplace::update_segment_by_request_and_type(coopname, request_id, marketplace::valid_segment("s2c"), [&](auto &s) {
    s.convert_in = convert_in;
    s.status = "convertin"_n;
  });
  
  // Списываем средства с ЦПП цифрового кошелька
  std::string convert_memo = "Конвертация средств из ЦПП 'Цифровой Кошелёк' в ЦПП 'Маркетплейс' для заказа №" + std::to_string(request_id);
  Wallet::sub_available_funds(_marketplace, coopname, username, total_cost, _wallet_program, convert_memo);
  
  // Добавляем средства на ЦПП маркетплейса
  Wallet::add_available_funds(_marketplace, coopname, username, total_cost, _marketplace_program, convert_memo);
  
  // Блокируем средства на программе маркетплейса
  std::string memo = "Создание заказа по программе №" + std::to_string(_marketplace_program_id) + " с ID: " + std::to_string(request_id);
  Wallet::block_funds(_marketplace, coopname, username, total_cost, _marketplace_program, memo);

}; 