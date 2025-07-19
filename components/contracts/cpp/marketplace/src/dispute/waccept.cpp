/**
\ingroup public_actions
\brief Принятие или отказ поставщика от товара в рамках гарантийного возврата

@details Поставщик может принять товар (accept=true) или отказаться от него (accept=false).
При принятии товар передается поставщику и диспут завершается.
При отказе товар остается у кооператива и диспут завершается.

@param coopname Имя кооператива
@param username Имя поставщика
@param exchange_id Идентификатор встречной заявки с диспутом
@param accept Принимает ли поставщик товар (true/false)
@param document Документ с решением поставщика

@note Авторизация требуется от аккаунта: @p coopname
*/
[[eosio::action]] void marketplace::waccept(eosio::name coopname, eosio::name username, uint64_t exchange_id, bool accept, document2 document) {
  require_auth(coopname);

  requests_index exchange(_marketplace, coopname.value);
  auto change = exchange.find(exchange_id);
  eosio::check(change != exchange.end(), "Заявка не найдена");
  eosio::check(change -> status == "woffered"_n, "Товар должен быть предложен поставщику");
  eosio::check(change -> product_contributor == username, "Только поставщик может принять решение о товаре");

  // Проверяем подпись документа
  verify_document_or_fail(document);

  if (accept) {
    // Поставщик принимает товар
    marketplace::update_segment_by_request_and_type(coopname, exchange_id, "wsupply"_n, [&](auto &s) {
      s.act_validation = document;
      s.status = "accepted"_n;
    });

    // Обновляем статус заявки
    exchange.modify(change, _marketplace, [&](auto &ch) {
      ch.status = "wcompleted"_n;
    });

  } else {
    // Поставщик отказывается от товара
    marketplace::update_segment_by_request_and_type(coopname, exchange_id, "wsupply"_n, [&](auto &s) {
      s.act_validation = document;
      s.status = "declined"_n;
    });

    // Обновляем статус заявки
    exchange.modify(change, _marketplace, [&](auto &ch) {
      ch.status = "wdeclined"_n;
    });
  }

  print("Поставщик ", username, (accept ? " принял" : " отказался от"), " товара. Диспут завершен.");
} 