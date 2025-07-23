/**
\ingroup public_actions
\brief Создать дочернюю заявку на имущественный паевой взнос (в ответ на родительский заказ).
*
* Данный метод позволяет пользователю создать встречную заявку на имущественный паевой взнос.
*
* @param coopname Имя кооператива
* @param username Имя пользователя, инициирующего заявку
* @param hash Хэш заявки (уникальный идентификатор)
* @param parent_hash Хэш родительской заявки
* @param units Количество частей (штук) товара или услуги
* @param unit_cost Цена за единицу (штуку) товара или услуги
* @param product_lifecycle_secs Время жизни продукта, заявляемое поставщиком
* @param braname Имя кооперативного участка куда будет поставляться товар
* @param document Сопутствующий подписанный документ на взнос или возврат взноса
* @param meta Метаданные о заявке
*
* @note Авторизация требуется от аккаунта: @p coopname
*/
[[eosio::action]] void marketplace::childoffer(eosio::name coopname, eosio::name braname, eosio::name username, checksum256 hash, checksum256 parent_hash, uint64_t units, eosio::asset unit_cost, uint32_t product_lifecycle_secs, document2 document, std::string meta) {
  require_auth(coopname);

  // Проверяем, что заявка с таким хэшем не существует
  auto existing_request = get_request_by_hash(coopname, hash);
  eosio::check(!existing_request.has_value(), "Заявка с таким хэшем уже существует");

  cooperatives2_index coops(_registrator, _registrator.value);
  auto coop = coops.find(coopname.value);
  eosio::check(coop != coops.end() && coop -> is_coop(), "Кооператив не найден");
  eosio::check(unit_cost.symbol == coop -> initial.symbol, "Неверный символ токена");
  eosio::check(units > 0, "Количество единиц в заявке должно быть больше нуля");
  eosio::check(unit_cost.amount >= 0, "Цена не может быть отрицательной");

  // Проверяем существование кооперативного участка
  get_branch_or_fail(coopname, braname);

  // Находим родительскую заявку по хэшу
  auto parent_change = get_request_by_hash_or_fail(coopname, parent_hash, "Родительская заявка не найдена");
  eosio::check(parent_change.type == "order"_n, "Родительская заявка должна быть заказом");

  eosio::check(parent_change.unit_cost.amount == unit_cost.amount, "Торги запрещены");
  eosio::check(product_lifecycle_secs > 0, "Гарантийный срок возврата для имущества должен быть установлен");
  
  //проводим проверку подписи документа
  verify_document_or_fail(document);

  
  // Используем константу marketplace program_id
  auto program = get_program_or_fail(coopname, _marketplace_program_id);

  participants_index participants(_soviet, coopname.value);
  auto participant = participants.find(username.value);      
  eosio::check(participant != participants.end(), "Вы не являетесь членом указанного кооператива");
  
  // Берем членский взнос и комиссию за отмену из родительского заказа
  eosio::asset membership_fee_amount = parent_change.membership_fee_amount;
  eosio::asset cancellation_fee_amount = parent_change.cancellation_fee_amount;
  eosio::asset supplier_amount = unit_cost * units;
  eosio::asset total_cost = supplier_amount + membership_fee_amount;
  
  // Проверяем что комиссия за отмену не превышает общую стоимость
  eosio::check(cancellation_fee_amount <= total_cost, "Комиссия за отмену не может превышать общую стоимость заказа");
  
  requests_index requests(_marketplace, coopname.value);
  uint64_t request_id = get_global_id(_marketplace, "requests"_n);
  
  requests.emplace(_marketplace, [&](auto &i) {
    i.id = id;
    i.hash = hash;
    i.parent_id = parent_change.id;
    i.parent_hash = parent_hash;
    i.parent_username = parent_change.username;
    i.type = "offer"_n; 
    i.coopname = coopname;
    i.username = username;
    i.status = "active"_n;
    i.remain_units = units;
    i.unit_cost = unit_cost;
    i.membership_fee_amount = membership_fee_amount;
    i.supplier_amount = supplier_amount;
    i.total_cost = total_cost;
    i.product_lifecycle_secs = product_lifecycle_secs;
    i.money_contributor = parent_change.username;
    i.product_contributor = username;
    i.created_at = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());
    i.cancellation_fee_amount = cancellation_fee_amount;
    i.braname = braname;
  });

  // Создаем сегмент для дочерней заявки поставки от пайщика в кооператив
  marketplace::create_segment(coopname, request_id, marketplace::valid_segment("s2c")); 
}; 