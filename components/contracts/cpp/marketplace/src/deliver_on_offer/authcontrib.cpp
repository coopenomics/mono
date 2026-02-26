/**
\ingroup public_actions
\brief Авторизация заявления на имущественный паевой взнос советом кооператива.

@details Совет авторизует заявление поставщика на взнос имуществом.
После авторизации заявка переходит в статус authorized — поставщик может начинать поставку.
Заявление на возврат будет подано и авторизовано отдельно, перед выдачей заказчику.

@param coopname Имя кооператива
@param request_hash Хэш заявки
@param authorization Документ авторизации от совета

@note Авторизация требуется от аккаунта: @p _soviet
**/
[[eosio::action]] void marketplace::authcontrib(eosio::name coopname, checksum256 request_hash, document2 authorization) {
  require_auth(_soviet);
  
  requests_index requests(_marketplace, coopname.value);
  auto change_opt = Marketplace::get_request_by_hash(coopname, request_hash);
  eosio::check(change_opt.has_value(), "Заявка не найдена");
  auto change = change_opt.value();
  
  eosio::check(change.status == "accepted"_n, "Только принятая заявка может быть авторизована");
  
  verify_document_or_fail(authorization);
  Document::validate_registry_id(authorization, 0);

  auto change_itr = requests.find(change.id);
  eosio::check(change_itr != requests.end(), "Заявка не найдена для обновления");
  requests.modify(change_itr, _marketplace, [&](auto &o){
    Document::add_document(o.documents, DocumentNames::CONTRIB_AUTH, authorization);
    o.status = "authorized"_n;
  });
}; 
