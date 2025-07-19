/**
\ingroup public_actions
\brief Предложение товара поставщику в рамках гарантийного возврата

@details Кооператив предлагает поставщику забрать товар, возвращенный заказчиком.
Создается предложение с актом передачи.

@param coopname Имя кооператива
@param username Имя председателя, предлагающего товар
@param exchange_id Идентификатор встречной заявки с диспутом
@param document Акт передачи товара поставщику

@note Авторизация требуется от аккаунта: @p coopname
*/
[[eosio::action]] void marketplace::woffer(eosio::name coopname, eosio::name username, uint64_t exchange_id, document2 document) {
  require_auth(coopname);

  requests_index exchange(_marketplace, coopname.value);
  auto change = exchange.find(exchange_id);
  eosio::check(change != exchange.end(), "Заявка не найдена");
  eosio::check(change -> status == "wreturned"_n, "Товар может быть предложен только после возврата в кооператив");

  auto soviet = get_board_by_type_or_fail(coopname, "soviet"_n);
  auto chairman = soviet.get_chairman();
  
  eosio::check(username == chairman, "Недостаточно прав доступа для предложения товара");
  
  // Проверяем подпись документа
  verify_document_or_fail(document);

  // Сохраняем акт передачи в wsupply сегменте
  marketplace::update_segment_by_request_and_type(coopname, exchange_id, "wsupply"_n, [&](auto &s) {
    s.act = document;
    s.status = "offered"_n;
  });

  // Обновляем статус заявки
  exchange.modify(change, _marketplace, [&](auto &ch) {
    ch.status = "woffered"_n;
  });
} 