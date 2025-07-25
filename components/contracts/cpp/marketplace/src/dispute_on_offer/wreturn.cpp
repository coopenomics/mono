/**
\ingroup public_actions
\brief Возврат товара от заказчика в кооператив

@details Заказчик возвращает товар в кооператив в рамках гарантийного возврата.
Председатель принимает товар и подписывает акт приёма.

@param coopname Имя кооператива
@param username Имя председателя, принимающего товар
@param request_hash Хэш встречной заявки с диспутом
@param document Акт приёма товара от заказчика

@note Авторизация требуется от аккаунта: @p coopname
*/
[[eosio::action]] void marketplace::wreturn(eosio::name coopname, eosio::name username, checksum256 request_hash, document2 document) {
  require_auth(coopname);

  requests_index requests(_marketplace, coopname.value);
  auto change_opt = Marketplace::get_request_by_hash(coopname, request_hash);
  eosio::check(change_opt.has_value(), "Заявка не найдена");
  auto change = change_opt.value();
  
  eosio::check(change.status == "wauthorized"_n, "Товар может быть возвращен только по авторизованному диспуту");

  auto soviet = get_board_by_type_or_fail(coopname, "soviet"_n);
  auto chairman = soviet.get_chairman();
  
  eosio::check(username == chairman, "Недостаточно прав доступа для принятия возврата");
  
  // Проверяем подпись документа
  verify_document_or_fail(document);

  // Сохраняем акт приёма в wreturn сегменте
  marketplace::update_segment_by_request_and_type(coopname, change.id, "wreturn"_n, [&](auto &s) {
    s.act1 = document;
    s.status = "returned"_n;
  });

  // Обновляем статус заявки
  auto change_itr = requests.find(change.id);
  eosio::check(change_itr != requests.end(), "Заявка не найдена для обновления");
  requests.modify(change_itr, _marketplace, [&](auto &ch) {
    ch.status = "wreturned"_n;
  });
} 