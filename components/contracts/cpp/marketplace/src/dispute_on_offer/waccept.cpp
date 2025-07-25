/**
\ingroup public_actions
\brief Принятие или отказ поставщика от товара в рамках гарантийного возврата

@details Поставщик может принять товар (accept=true) или отказаться от него (accept=false).
При принятии товар передается поставщику и диспут завершается.
При отказе товар остается у кооператива и диспут завершается.

@param coopname Имя кооператива
@param username Имя поставщика
@param request_hash Хэш встречной заявки с диспутом
@param accept Принимает ли поставщик товар (true/false)
@param document Документ с решением поставщика

@note Авторизация требуется от аккаунта: @p coopname
*/
[[eosio::action]] void marketplace::waccept(eosio::name coopname, eosio::name username, checksum256 request_hash, bool accept, document2 document) {
  require_auth(coopname);

  auto change_opt = Marketplace::get_request_by_hash(coopname, request_hash);
  eosio::check(change_opt.has_value(), "Заявка не найдена");
  auto change = change_opt.value();
  
  eosio::check(change.status == "woffered"_n, "Товар должен быть предложен поставщику");
  eosio::check(change.product_contributor == username, "Только поставщик может принять решение о товаре");

  // Проверяем подпись документа
  verify_document_or_fail(document);

  // ИСПРАВЛЕНИЕ: Возвращаем заблокированные единицы товара в родительскую заявку
  requests_index requests(_marketplace, coopname.value);
  auto parent_change = requests.find(change.parent_id);
  eosio::check(parent_change != requests.end(), "Родительская заявка не найдена");

  if (change.blocked_units > 0) {
    requests.modify(parent_change, _marketplace, [&](auto &e) {
      e.remaining_units += change.blocked_units;
      e.blocked_units -= change.blocked_units;
      e.base_cost = e.remaining_units * e.unit_cost;
    });
  }

  if (accept) {
    // Поставщик принимает товар
    marketplace::update_segment_by_request_and_type(coopname, change.id, "wsupply"_n, [&](auto &s) {
      s.act2 = document;
      s.status = "accepted"_n;
    });

    // Обновляем статус заявки
    auto change_itr = requests.find(change.id);
    eosio::check(change_itr != requests.end(), "Заявка не найдена для обновления");
    requests.modify(change_itr, _marketplace, [&](auto &ch) {
      ch.status = "wcompleted"_n;
      ch.blocked_units = 0; // Обнуляем заблокированные единицы
    });

  } else {
    // Поставщик отказывается от товара
    marketplace::update_segment_by_request_and_type(coopname, change.id, "wsupply"_n, [&](auto &s) {
      s.act2 = document;
      s.status = "declined"_n;
    });

    // Обновляем статус заявки
    auto change_itr = requests.find(change.id);
    eosio::check(change_itr != requests.end(), "Заявка не найдена для обновления");
    requests.modify(change_itr, _marketplace, [&](auto &ch) {
      ch.status = "wdeclined"_n;
      ch.blocked_units = 0; // Обнуляем заблокированные единицы
    });
  }

  print("Поставщик ", username, (accept ? " принял" : " отказался от"), " товара. Диспут завершен.");
} 