/**
\ingroup public_actions
\brief Создать заказ — заказчик публикует запрос «поставьте мне».

@details Заказчик создаёт заказ типа order с указанием желаемого количества,
стоимости, характеристик. Средства блокируются сразу.
Поставщики могут откликнуться встречными предложениями (offer).

@param coopname Имя кооператива
@param receiver_braname КУ заказчика
@param username Имя заказчика
@param hash Хэш заказа
@param units Желаемое количество
@param unit_cost Предлагаемая цена за единицу
@param product_lifecycle_secs Желаемый срок годности
@param warranty_period_secs Желаемый гарантийный срок
@param membership_fee_amount Членский взнос
@param cancellation_fee_amount Штраф за отмену
@param convert_in Заявление на конвертацию
@param delivery_type Тип доставки: "internal" или "external"
@param meta Метаданные

@note Авторизация: @p coopname
**/
[[eosio::action]] void marketplace::createorder(eosio::name coopname, eosio::name receiver_braname, eosio::name username, checksum256 hash, uint64_t units, eosio::asset unit_cost, uint32_t product_lifecycle_secs, uint32_t warranty_period_secs, eosio::asset membership_fee_amount, eosio::asset cancellation_fee_amount, document2 convert_in, eosio::name delivery_type, std::string meta) {
  require_auth(coopname);
  
  auto existing = get_request_by_hash(coopname, hash);
  eosio::check(!existing.has_value(), "Заказ с таким хэшем уже существует");
  
  auto coop = get_cooperative_or_fail(coopname);
  eosio::check(unit_cost.symbol == coop.initial.symbol, "Неверный символ токена");
  eosio::check(membership_fee_amount.symbol == coop.initial.symbol, "Неверный символ для членского взноса");
  eosio::check(cancellation_fee_amount.symbol == coop.initial.symbol, "Неверный символ для штрафа");
  eosio::check(units > 0, "Количество должно быть больше нуля");
  eosio::check(delivery_type == "internal"_n || delivery_type == "external"_n, "Тип доставки: internal или external");
  
  get_participant_or_fail(coopname, username);
  get_branch_or_fail(coopname, receiver_braname);
  auto program = get_program_or_fail(coopname, _marketplace_program_id);

  verify_document_or_fail(convert_in);
  
  eosio::asset base_cost = unit_cost * units;
  eosio::asset total_cost = base_cost + membership_fee_amount;
  eosio::check(cancellation_fee_amount <= total_cost, "Штраф не может превышать общую стоимость");

  requests_index requests(_marketplace, coopname.value);
  uint64_t request_id = get_global_id(_marketplace, "requests"_n);
  
  std::string memo = "Заказ №" + std::to_string(request_id);
  
  std::vector<Document::named_document> documents;
  Document::add_document(documents, DocumentNames::CONVERT_FROM, convert_in);
  
  requests.emplace(_marketplace, [&](auto &i) {
    i.id = request_id;
    i.hash = hash;
    i.type = "order"_n;
    i.username = username;
    i.coopname = coopname;
    i.status = "active"_n;
    i.units = units;
    i.unit_cost = unit_cost;
    i.base_cost = base_cost;
    i.membership_fee_amount = membership_fee_amount;
    i.total_cost = total_cost;
    i.product_lifecycle_secs = product_lifecycle_secs;
    i.warranty_period_secs = warranty_period_secs;
    i.money_contributor = username;
    i.meta = meta;
    i.created_at = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());
    i.cancellation_fee_amount = cancellation_fee_amount;
    i.receiver_braname = receiver_braname;
    i.documents = documents;
  });

  // Блокировка средств заказчика
  Wallet::sub_available_funds(_marketplace, coopname, username, total_cost, _wallet_program, memo);
  Wallet::add_available_funds(_marketplace, coopname, username, total_cost, _marketplace_program, memo);
  Wallet::block_funds(_marketplace, coopname, username, total_cost, _marketplace_program, memo);
}; 
