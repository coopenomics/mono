/**
\ingroup public_actions
\brief Авторизация заявления на возврат паевого взноса имуществом.

@details Совет авторизует заявление заказчика на возврат паевого взноса.
Вызывается ПОСЛЕ подачи заявления заказчиком (requestreturn),
когда имущество уже доставлено на КУ и готово к выдаче.

@param coopname Имя кооператива
@param request_hash Хэш заявки
@param authorization Документ авторизации от совета

@note Авторизация требуется от аккаунта: @p _soviet
**/
[[eosio::action]] void marketplace::authreturn(eosio::name coopname, checksum256 request_hash, document2 authorization) {
  require_auth(_soviet);
  
  requests_index requests(_marketplace, coopname.value);
  auto change_opt = Marketplace::get_request_by_hash(coopname, request_hash);
  eosio::check(change_opt.has_value(), "Заявка не найдена");
  auto change = change_opt.value();
  
  // Заявка должна быть в статусе delivered (имущество доставлено и ждёт выдачи)
  eosio::check(change.status == "reqreturn"_n, "Возврат можно авторизовать только для заявки с запрошенным возвратом");
  
  verify_document_or_fail(authorization);
  Document::validate_registry_id(authorization, 0);

  auto change_itr = requests.find(change.id);
  eosio::check(change_itr != requests.end(), "Заявка не найдена для обновления");
  requests.modify(change_itr, _marketplace, [&](auto &o){
    Document::add_document(o.documents, DocumentNames::RETURN_AUTH, authorization);
    o.status = "retauthorized"_n;
  });
}; 
