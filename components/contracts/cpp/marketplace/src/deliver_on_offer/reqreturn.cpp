/**
\ingroup public_actions
\brief Запрос на возврат паевого взноса имуществом — перед получением.

@details Заказчик подаёт заявление на возврат паевого взноса имуществом.
Вызывается когда имущество доставлено на КУ получателя (статус delivered).
Председатель КУ фиксирует факт выдачи и точные параметры имущества (вес, количество).

Создаёт пункт повестки для совета на авторизацию возврата.

@param coopname Имя кооператива
@param username Имя заказчика
@param request_hash Хэш заявки
@param return_statement Заявление на возврат паевого взноса (обновлённое, с точным весом)

@note Авторизация требуется от аккаунта: @p coopname
**/
[[eosio::action]] void marketplace::reqreturn(eosio::name coopname, eosio::name username, checksum256 request_hash, document2 return_statement) {
  require_auth(coopname);
  
  requests_index requests(_marketplace, coopname.value);
  auto change_opt = Marketplace::get_request_by_hash(coopname, request_hash);
  eosio::check(change_opt.has_value(), "Заявка не найдена");
  auto change = change_opt.value();
  
  // Имущество должно быть доставлено и готово к выдаче
  eosio::check(change.status == "delivered"_n, "Запрос возврата возможен только для доставленного имущества");
  eosio::check(change.money_contributor == username, "Только заказчик может запросить возврат");
  
  verify_document_or_fail(return_statement);
  Document::validate_registry_id(return_statement, 0);

  auto change_itr = requests.find(change.id);
  eosio::check(change_itr != requests.end(), "Заявка не найдена для обновления");
  
  // Обновляем/добавляем заявление на возврат с актуальными данными
  requests.modify(change_itr, _marketplace, [&](auto &o){
    // Удаляем старое заявление на возврат если было
    Document::remove_document(o.documents, DocumentNames::RETURN_STMT);
    Document::add_document(o.documents, DocumentNames::RETURN_STMT, return_statement);
    o.status = "reqreturn"_n;
  });

  // Отправляем заявление на возврат в совет
  ::Soviet::create_agenda(
    _marketplace,
    coopname,
    username,
    get_valid_soviet_action("authreturn"_n),
    change.hash,
    _marketplace,
    Marketplace::get_valid_marketplace_action("authreturn"_n),
    "declineacc"_n,
    return_statement,
    std::string("")
  );
}; 
