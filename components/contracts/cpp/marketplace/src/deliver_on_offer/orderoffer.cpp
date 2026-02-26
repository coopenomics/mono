/**
\ingroup public_actions
\brief Создать заявку orderoffer — заказчик создаёт заявку на поставку товара.

@details Заказчик создаёт заявку на поставку. Средства блокируются сразу.
Заявление на возврат НЕ подаётся на этом этапе — оно будет подано перед получением
(requestreturn), когда известен точный вес/состав имущества.

@param coopname Имя кооператива
@param receiver_braname КУ заказчика для получения товара
@param username Имя заказчика
@param hash Хэш заявки
@param units Количество единиц товара
@param unit_cost Цена за единицу
@param product_lifecycle_secs Срок годности продукта
@param warranty_period_secs Гарантийный срок
@param membership_fee_amount Членский взнос
@param cancellation_fee_amount Штраф за отмену
@param convert_in Заявление на конвертацию из кошелька в маркетплейс
@param meta Метаданные

@note Авторизация требуется от аккаунта: @p coopname
*/
[[eosio::action]] void marketplace::orderoffer(eosio::name coopname, eosio::name receiver_braname, eosio::name username, checksum256 hash, uint64_t units, eosio::asset unit_cost, uint32_t product_lifecycle_secs, uint32_t warranty_period_secs, eosio::asset membership_fee_amount, eosio::asset cancellation_fee_amount, document2 convert_in, std::string meta) {
  require_auth(coopname);
  
  auto existing_request = get_request_by_hash(coopname, hash);
  eosio::check(!existing_request.has_value(), "Заявка с таким хэшем уже существует");
  
  auto coop = get_cooperative_or_fail(coopname);  
  eosio::check(unit_cost.symbol == coop.initial.symbol, "Неверный символ токена");
  eosio::check(membership_fee_amount.symbol == coop.initial.symbol, "Неверный символ токена для членского взноса");
  eosio::check(cancellation_fee_amount.symbol == coop.initial.symbol, "Неверный символ токена для комиссии отмены");
  eosio::check(units > 0, "Количество единиц должно быть больше нуля");
  eosio::check(unit_cost.amount >= 0, "Цена не может быть отрицательной");
  eosio::check(membership_fee_amount.amount >= 0, "Членский взнос не может быть отрицательным");
  eosio::check(cancellation_fee_amount.amount >= 0, "Комиссия за отмену не может быть отрицательной");
  
  get_participant_or_fail(coopname, username);
  get_branch_or_fail(coopname, receiver_braname);
  auto program = get_program_or_fail(coopname, _marketplace_program_id);

  eosio::check(product_lifecycle_secs > 0, "Срок годности должен быть установлен");
  eosio::check(warranty_period_secs > 0, "Гарантийный срок должен быть больше нуля");

  verify_document_or_fail(convert_in);
  Document::validate_registry_id(convert_in, 0);

  eosio::asset base_cost = unit_cost * units;
  eosio::asset total_cost = base_cost + membership_fee_amount;
  
  eosio::check(cancellation_fee_amount <= total_cost, "Комиссия за отмену не может превышать общую стоимость");

  requests_index requests(_marketplace, coopname.value);
  uint64_t request_id = get_global_id(_marketplace, "requests"_n);
  
  std::string memo = "Начало поставки по программе №" + std::to_string(_marketplace_program_id) + " с ID: " + std::to_string(request_id);
  
  std::vector<Document::named_document> documents;
  Document::add_document(documents, DocumentNames::CONVERT_FROM, convert_in);
  
  requests.emplace(_marketplace, [&](auto &i) {
    i.id = request_id;
    i.hash = hash;
    i.type = "orderoffer"_n;
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

  std::string convert_memo = "Конвертация средств для заказа №" + std::to_string(request_id);
  Wallet::sub_available_funds(_marketplace, coopname, username, total_cost, _wallet_program, convert_memo);
  Wallet::add_available_funds(_marketplace, coopname, username, total_cost, _marketplace_program, convert_memo);
  Wallet::block_funds(_marketplace, coopname, username, total_cost, _marketplace_program, memo);
}; 
