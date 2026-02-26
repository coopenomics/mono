/**
\ingroup public_actions
\brief Получение товара заказчиком.

@details Заказчик приходит на КУ для получения имущества. 
Председатель КУ подписывает акт и передаёт имущество заказчику.
Получение возможно ТОЛЬКО после авторизации возврата советом (статус retauthorized).

@param coopname Имя кооператива
@param username Имя заказчика (председатель КУ подписывает от лица кооператива)
@param request_hash Хэш заявки
@param document Акт получения имущества (подпись председателя КУ)

@note Авторизация требуется от аккаунта: @p coopname
**/
[[eosio::action]] void marketplace::receive(eosio::name coopname, eosio::name username, checksum256 request_hash, document2 document) {
  require_auth(coopname);
  
  requests_index requests(_marketplace, coopname.value);
  auto change_opt = Marketplace::get_request_by_hash(coopname, request_hash);
  eosio::check(change_opt.has_value(), "Заявка не найдена");
  auto change = change_opt.value();
  
  // Получение возможно только после авторизации возврата советом
  eosio::check(change.status == "retauthorized"_n, "Получение возможно только после авторизации возврата советом");
  eosio::check(change.money_contributor == username, "Недостаточно прав доступа");
  
  verify_document_or_fail(document);
  Document::validate_registry_id(document, 0);

  auto change_itr = requests.find(change.id);
  eosio::check(change_itr != requests.end(), "Заявка не найдена для обновления");
  requests.modify(change_itr, _marketplace, [&](auto &o){
    o.status = "received1"_n;
    Document::add_document(o.documents, DocumentNames::RECEIVE_ACT, document);
  });
}; 
