/**
\ingroup public_actions
\brief Создать родительскую заявку на имущественный паевой взнос.
*
* Данный метод позволяет пользователю создать родительскую заявку на имущественный паевой взнос.
*
* @param coopname Имя кооператива
* @param username Имя пользователя, инициирующего заявку
* @param hash Хэш заявки (уникальный идентификатор)
* @param units Количество частей (штук) товара или услуги
* @param unit_cost Цена за единицу (штуку) товара или услуги
* @param product_lifecycle_secs Время жизни продукта, заявляемое поставщиком
* @param warranty_period_secs Гарантийный срок в секундах
* @param membership_fee_amount Сумма членского взноса
* @param cancellation_fee_amount Сумма комиссии за отмену заявки
* @param braname Имя кооперативного участка куда будет поставляться товар
* @param meta Метаданные о заявке
*
* @note Авторизация требуется от аккаунта: @p coopname
*/
[[eosio::action]] void marketplace::parentoffer(eosio::name coopname, eosio::name braname, eosio::name username, checksum256 hash, uint64_t units, eosio::asset unit_cost, uint32_t product_lifecycle_secs, uint32_t warranty_period_secs, eosio::asset membership_fee_amount, eosio::asset cancellation_fee_amount, std::string meta) {
  require_auth(coopname);
  
  // Проверяем, что заявка с таким хэшем не существует
  auto existing_request = get_request_by_hash(coopname, hash);
  eosio::check(!existing_request.has_value(), "Заявка с таким хэшем уже существует");
  
  // Проверяем, что символ токена совпадает с символом токена кооператива
  auto coop = get_cooperative_or_fail(coopname);  
  eosio::check(unit_cost.symbol == coop.initial.symbol, "Неверный символ токена");
  eosio::check(membership_fee_amount.symbol == coop.initial.symbol, "Неверный символ токена для членского взноса");
  eosio::check(cancellation_fee_amount.symbol == coop.initial.symbol, "Неверный символ токена для комиссии отмены");
  eosio::check(units > 0, "Количество единиц в заявке должно быть больше нуля");
  eosio::check(unit_cost.amount >= 0, "Цена не может быть отрицательной");
  eosio::check(membership_fee_amount.amount >= 0, "Членский взнос не может быть отрицательным");
  eosio::check(cancellation_fee_amount.amount >= 0, "Комиссия за отмену не может быть отрицательной");
  
  // Проверяем, что пользователь является пайщиком кооператива
  get_participant_or_fail(coopname, username);

  // Проверяем существование кооперативного участка
  get_branch_or_fail(coopname, braname);
  
  // Проверяем существование программы маркетплейса
  auto program = get_program_or_fail(coopname, _marketplace_program_id);

  // Гарантийный срок возврата должен быть установлен для предложений
  eosio::check(product_lifecycle_secs > 0, "Гарантийный срок возврата для имущества должен быть установлен");
  eosio::check(warranty_period_secs > 0, "Гарантийный срок должен быть больше нуля");

  // Для предложения рассчитываем общую стоимость включая членский взнос
  eosio::asset base_cost = unit_cost * units;
  eosio::asset total_cost = base_cost + membership_fee_amount;
  
  // Проверяем что комиссия за отмену не превышает общую стоимость
  eosio::check(cancellation_fee_amount <= total_cost, "Комиссия за отмену не может превышать общую стоимость предложения");

  requests_index requests(_marketplace, coopname.value);
  uint64_t request_id = get_global_id(_marketplace, "requests"_n);
  requests.emplace(_marketplace, [&](auto &i) {
    i.id = request_id;
    i.hash = hash;
    i.type = "offer"_n;
    i.username = username;
    i.coopname = coopname;
    i.status = "active"_n;
    i.remaining_units = units;
    i.unit_cost = unit_cost;
    i.base_cost = base_cost;
    i.membership_fee_amount = membership_fee_amount;
    i.total_cost = total_cost;
    i.product_lifecycle_secs = product_lifecycle_secs;
    i.warranty_period_secs = warranty_period_secs;
    i.meta = meta;
    i.created_at = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());
    i.cancellation_fee_amount = cancellation_fee_amount;
    i.braname = braname;
  });
  
  // Создаем сегмент для родительской заявки поставки от пайщика в кооператив
  marketplace::create_segment(coopname, request_id, marketplace::valid_segment("s2c"), username);
  
}; 