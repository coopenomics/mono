/**
\ingroup public_actions
\brief Поставщик откликается на заказ встречным предложением.

@details Поставщик видит заказ и предлагает поставку.
Создаёт встречную заявку типа offer, привязанную к order.
Заявление на взнос имуществом отправляется в совет.

@param coopname Имя кооператива
@param supplier_braname КУ поставщика
@param username Имя поставщика
@param order_hash Хэш заказа
@param offer_hash Хэш предложения
@param units Количество предлагаемых единиц
@param product_lifecycle_secs Срок годности от поставщика
@param contribution_statement Заявление на взнос имуществом
@param convert_out Заявление на конвертацию

@note Авторизация: @p coopname
**/
[[eosio::action]] void marketplace::respondoffer(eosio::name coopname, eosio::name supplier_braname, eosio::name username, checksum256 order_hash, checksum256 offer_hash, uint64_t units, uint32_t product_lifecycle_secs, document2 contribution_statement, document2 convert_out) {
  require_auth(coopname);
  
  auto order_opt = Marketplace::get_request_by_hash(coopname, order_hash);
  eosio::check(order_opt.has_value(), "Заказ не найден");
  auto order = order_opt.value();
  
  eosio::check(order.type == "order"_n, "respondoffer применим только к заказам типа order");
  eosio::check(order.status == "active"_n, "Заказ должен быть активным");
  eosio::check(units > 0 && units <= order.units, "Недопустимое количество единиц");
  
  auto existing_offer = get_request_by_hash(coopname, offer_hash);
  eosio::check(!existing_offer.has_value(), "Предложение с таким хэшем уже существует");
  
  get_participant_or_fail(coopname, username);
  get_branch_or_fail(coopname, supplier_braname);
  
  verify_document_or_fail(contribution_statement);
  verify_document_or_fail(convert_out);
  
  eosio::asset supplier_amount = order.unit_cost * units;
  
  requests_index requests(_marketplace, coopname.value);
  uint64_t offer_id = get_global_id(_marketplace, "requests"_n);
  
  std::vector<Document::named_document> documents;
  Document::add_document(documents, DocumentNames::CONTRIB_STMT, contribution_statement);
  Document::add_document(documents, DocumentNames::CONVERT_TO, convert_out);
  
  requests.emplace(_marketplace, [&](auto &i) {
    i.id = offer_id;
    i.hash = offer_hash;
    i.type = "offer"_n;
    i.username = username;
    i.coopname = coopname;
    i.status = "accepted"_n;
    i.units = units;
    i.unit_cost = order.unit_cost;
    i.base_cost = supplier_amount;
    i.membership_fee_amount = eosio::asset(0, order.unit_cost.symbol);
    i.total_cost = supplier_amount;
    i.product_lifecycle_secs = product_lifecycle_secs;
    i.warranty_period_secs = order.warranty_period_secs;
    i.money_contributor = order.money_contributor;
    i.product_contributor = username;
    i.meta = "";
    i.created_at = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());
    i.accepted_at = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());
    i.cancellation_fee_amount = eosio::asset(0, order.unit_cost.symbol);
    i.receiver_braname = order.receiver_braname;
    i.supplier_braname = supplier_braname;
    i.documents = documents;
  });

  // Отправляем заявление на взнос в совет
  ::Soviet::create_agenda(
    _marketplace,
    coopname,
    username,
    get_valid_soviet_action("authcontrib"_n),
    offer_hash,
    _marketplace,
    Marketplace::get_valid_marketplace_action("authcontrib"_n),
    "declineacc"_n,
    contribution_statement,
    std::string("")
  );
}; 
