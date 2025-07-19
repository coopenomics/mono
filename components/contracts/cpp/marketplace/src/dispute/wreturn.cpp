/**
\ingroup public_actions
\brief Возврат товара от заказчика в кооператив

@details Заказчик возвращает товар в кооператив в рамках гарантийного возврата.
Председатель принимает товар и подписывает акт приёма.

@param coopname Имя кооператива
@param username Имя председателя, принимающего товар
@param exchange_id Идентификатор встречной заявки с диспутом
@param document Акт приёма товара от заказчика

@note Авторизация требуется от аккаунта: @p coopname
*/
[[eosio::action]] void marketplace::wreturn(eosio::name coopname, eosio::name username, uint64_t exchange_id, document2 document) {
  require_auth(coopname);

  requests_index exchange(_marketplace, coopname.value);
  auto change = exchange.find(exchange_id);
  eosio::check(change != exchange.end(), "Заявка не найдена");
  eosio::check(change -> status == "wauthorized"_n, "Товар может быть возвращен только по авторизованному диспуту");

  auto soviet = get_board_by_type_or_fail(coopname, "soviet"_n);
  auto chairman = soviet.get_chairman();
  
  eosio::check(username == chairman, "Недостаточно прав доступа для принятия возврата");
  
  // Проверяем подпись документа
  verify_document_or_fail(document);

  // Сохраняем акт приёма в wreturn сегменте
  marketplace::update_segment_by_request_and_type(coopname, exchange_id, "wreturn"_n, [&](auto &s) {
    s.act = document;
    s.status = "returned"_n;
  });

  // Обновляем статус заявки
  exchange.modify(change, _marketplace, [&](auto &ch) {
    ch.status = "wreturned"_n;
  });
} 