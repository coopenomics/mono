/**
\ingroup public_actions
\brief Создать дочернюю заявку на денежный паевой взнос (в ответ на родительское предложение).
*
* Данный метод позволяет пользователю создать встречную заявку на денежный паевой взнос.
*
* @param coopname Имя кооператива
* @param username Имя пользователя, инициирующего заявку
* @param hash Хэш заявки (уникальный идентификатор)
* @param parent_hash Хэш родительской заявки
* @param units Количество частей (штук) товара или услуги
* @param unit_cost Цена за единицу (штуку) товара или услуги
* @param braname Имя кооперативного участка откуда будет забираться товар
 * @param statement Заявление на возврат паевого взноса имуществом
 * @param convert_in Заявление на конвертацию из кошелька в маркетплейс
 * @param meta Метаданные о заявке
*
* @note Авторизация требуется от аккаунта: @p coopname
*/
[[eosio::action]] void marketplace::childorder(eosio::name coopname, eosio::name braname, eosio::name username, checksum256 hash, checksum256 parent_hash, uint64_t units, eosio::asset unit_cost, document2 statement, document2 convert_in, std::string meta) {
  require_auth(coopname);

  // Проверяем, что заявка с таким хэшем не существует
  auto existing_request = get_request_by_hash(coopname, hash);
  eosio::check(!existing_request.has_value(), "Заявка с таким хэшем уже существует");

  auto coop = get_cooperative_or_fail(coopname);  
  eosio::check(unit_cost.symbol == coop.initial.symbol, "Неверный символ токена");
  eosio::check(units > 0, "Количество единиц в заявке должно быть больше нуля");
  eosio::check(unit_cost.amount >= 0, "Цена не может быть отрицательной");

  // Проверяем существование кооперативного участка
  get_branch_or_fail(coopname, braname);

  // Находим родительскую заявку по хэшу
  auto parent_change = get_request_by_hash_or_fail(coopname, parent_hash, "Родительская заявка не найдена");
  eosio::check(parent_change.type == "offer"_n, "Родительская заявка должна быть предложением");
    
  eosio::check(parent_change.unit_cost.amount == unit_cost.amount, "Торги запрещены. Стоимость единицы не совпадает с родительской заявкой");
  
  //проводим проверку подписи документа
  verify_document_or_fail(statement);
  verify_document_or_fail(convert_in);

  // Используем константу marketplace program_id
  auto program = get_program_or_fail(coopname, _marketplace_program_id);

  // Проверяем, что пользователь является пайщиком кооператива
  get_participant_or_fail(coopname, username);
  
  // Берем членский взнос и комиссию за отмену из родительского предложения
  eosio::asset membership_fee_amount = parent_change.membership_fee_amount;
  eosio::asset cancellation_fee_amount = parent_change.cancellation_fee_amount;
  eosio::asset supplier_amount = unit_cost * units;
  eosio::asset total_cost = supplier_amount + membership_fee_amount;
  
  // Проверяем что комиссия за отмену не превышает общую стоимость
  eosio::check(cancellation_fee_amount <= total_cost, "Комиссия за отмену не может превышать общую стоимость заказа");
  
  std::string memo = "Начало поставки по программе №" + std::to_string(_marketplace_program_id) + " с ID: " + std::to_string(request_id);

  requests_index requests(_marketplace, coopname.value);
  uint64_t request_id = get_global_id(_marketplace, "requests"_n);
  
  requests.emplace(_marketplace, [&](auto &i) {
    i.id = request_id;
    i.hash = hash;
    i.parent_id = parent_change.id;
    i.parent_hash = parent_hash;
    i.parent_username = parent_change.username;
    i.type = "order"_n; 
    i.coopname = coopname;
    i.username = username;
    i.status = "active"_n;
    i.remain_units = units;
    i.unit_cost = unit_cost;
    i.membership_fee_amount = membership_fee_amount;
    i.supplier_amount = supplier_amount;
    i.total_cost = total_cost;
    i.product_lifecycle_secs = parent_change.product_lifecycle_secs;
    i.money_contributor = username;
    i.product_contributor = parent_change.username;
    i.created_at = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());
    i.cancellation_fee_amount = cancellation_fee_amount;
    i.braname = braname;
  });

  // Создаем сегмент для дочерней заявки поставки из кооператива - заказчику
  marketplace::create_segment(coopname, request_id, marketplace::valid_segment("c2r"));
  
  // Сохраняем заявление на конвертацию и заявление на возврат в contribute сегменте
  marketplace::update_segment_by_request_and_type(coopname, request_id, marketplace::valid_segment("s2c"), [&](auto &s) {
    s.convert_in = convert_in;
    s.statement = statement;
    s.status = "statement"_n;
  });

  //Для блокировки средств необходимо их иметь на ЦПП, т.е. предварительно необходимо сконвертировать их с ЦПП кошелька
  // Списываем средства с ЦПП цифрового кошелька
  std::string convert_memo = "Конвертация средств из ЦПП 'Цифровой Кошелёк' в ЦПП 'Маркетплейс' для заказа №" + std::to_string(request_id);
  Wallet::sub_available_funds(_marketplace, coopname, username, total_cost, _wallet_program, convert_memo);
  
  // Добавляем средства на ЦПП маркетплейса
  Wallet::add_available_funds(_marketplace, coopname, username, total_cost, _marketplace_program, convert_memo);
  
  // Блокируем средства на программе маркетплейса
  Wallet::block_funds(_marketplace, coopname, username, total_cost, _marketplace_program, memo);
  
}; 