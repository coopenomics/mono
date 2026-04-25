/**
\ingroup public_actions
\brief Принятие заявки поставщиком.

@details Поставщик принимает заявку orderoffer на поставку имущества.
При принятии создаётся ОДНО заявление в совет — на имущественный паевой взнос.
Заявление на возврат будет создано позже, перед получением имущества заказчиком.

@param coopname Имя кооператива
@param supplier_braname Имя кооперативного участка поставщика
@param username Имя поставщика
@param request_hash Хэш заявки
@param convert_out Заявление на конвертацию в кошелек (сохраняется для будущего использования)
@param product_contribution_statement Заявление на имущественный паевой взнос

@note Авторизация требуется от аккаунта: @p coopname
**/
[[eosio::action]] void marketplace::accept(eosio::name coopname, eosio::name supplier_braname, eosio::name username, checksum256 request_hash, document2 convert_out, document2 product_contribution_statement) { 
  require_auth(coopname);
  
  requests_index requests(_marketplace, coopname.value);
  auto change_opt = Marketplace::get_request_by_hash(coopname, request_hash);
  eosio::check(change_opt.has_value(), "Заявка не найдена");
  auto change = change_opt.value();
  
  eosio::check(change.status == "active"_n, "Только активная заявка может быть принята");
  eosio::check(change.type == "orderoffer"_n, "Метод accept применим только к заявкам типа orderoffer");
  
  get_branch_or_fail(coopname, supplier_braname);
  
  verify_document_or_fail(convert_out);
  verify_document_or_fail(product_contribution_statement);
  
  Document::validate_registry_id(convert_out, 0);
  Document::validate_registry_id(product_contribution_statement, 0);

  auto change_itr = requests.find(change.id);
  eosio::check(change_itr != requests.end(), "Заявка не найдена для обновления");
  requests.modify(change_itr, _marketplace, [&](auto &o){
    o.status = "accepted"_n;
    o.accepted_at = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());
    o.product_contributor = username;
    o.supplier_braname = supplier_braname;
    Document::add_document(o.documents, DocumentNames::CONVERT_TO, convert_out);
    Document::add_document(o.documents, DocumentNames::CONTRIB_STMT, product_contribution_statement);
  });

  checksum256 agenda_hash = change.hash;

  // Одно заявление в совет — на имущественный паевой взнос
  ::Soviet::create_agenda(
    _marketplace,
    coopname,
    username,
    get_valid_soviet_action("authcontrib"_n),
    agenda_hash,
    _marketplace,
    Marketplace::get_valid_marketplace_action("authcontrib"_n),
    "declineacc"_n,
    product_contribution_statement,
    std::string("")
  );
}; 
