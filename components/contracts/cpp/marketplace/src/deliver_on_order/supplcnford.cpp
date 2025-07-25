/**
\ingroup public_actions
\brief Подтверждение поставки товара для направления deliver_on_order (supplcnford).

@details Председатель совета подтверждает поставку имущества поставщиком на основе предоставленного документа.
Встречная заявка должна быть предварительно в статусе "поставлено".

Процесс: ORDER (parent) → OFFER (child)
- Parent: денежный паевой взнос (заказчик)
- Child: имущественный паевой взнос (поставщик)

@param coopname Имя кооператива
@param username Имя председателя совета
@param request_hash Хэш встречной заявки (offer)
@param document Документ подтверждения поставки

@note Авторизация требуется от аккаунта: @p coopname
*/
[[eosio::action]] void marketplace::supplcnford(eosio::name coopname, eosio::name username, checksum256 request_hash, document2 document) {
  require_auth(coopname);

  requests_index requests(_marketplace, coopname.value);
  auto change_opt = Marketplace::get_request_by_hash(coopname, request_hash);
  eosio::check(change_opt.has_value(), "Заявка не найдена");
  auto change = change_opt.value();

  eosio::check(change.status == "supplied"_n, "Подтверждение поставки возможно только после поставки");
  eosio::check(change.type == "offer"_n, "Метод ordersupplyconfirm применим только к заявкам типа offer");
  eosio::check(change.parent_id > 0, "У встречной заявки должна быть родительская заявка");

  auto parent_change_opt = Marketplace::get_request_by_hash(coopname, change.parent_hash);
  eosio::check(parent_change_opt.has_value(), "Родительская заявка не найдена");
  auto parent_change = parent_change_opt.value();
  
  eosio::check(parent_change.type == "order"_n, "Родительская заявка должна быть типа order");

  auto branch = get_branch_or_fail(coopname, change.braname);
  
  //Проверяем права доступа на КУ (председатель или доверенное лицо)
  eosio::check(branch.is_user_authorized(username), "Недостаточно прав доступа для приёма имущества");

  //проводим проверку подписи документа
  verify_document_or_fail(document);

  std::string memo = "Поставка имущества по программе №" + std::to_string(_marketplace_program_id) + " с ID: " + std::to_string(change.id);

  // Начисляем поставщику заблокированный баланс в цифровой кошелек
  Wallet::add_blocked_funds(_marketplace, coopname, change.product_contributor, change.base_cost, _marketplace_program, memo);

  // Увеличиваем сумму циркуляции в системе на сумму взноса
  Fund::add_circulating_funds(_marketplace, coopname, parent_change.total_cost);

  // Обновляем статус встречной заявки
  auto change_itr = requests.find(change.id);
  eosio::check(change_itr != requests.end(), "Встречная заявка не найдена для обновления");
  requests.modify(change_itr, _marketplace, [&](auto &o) { 
    o.status = "supplied1"_n;
  });

  // Проверяем инварианты дочерней заявки
  auto updated_change = requests.find(change.id);
  marketplace::check_units_invariant(*updated_change, "ordersupplyconfirm_update");

  // Обновляем contribute сегмент документом подтверждения
  marketplace::update_segment_by_request_and_type(coopname, change.id, marketplace::valid_segment("s2c"), [&](auto &s) {
    s.act2 = document;
    s.status = "supplied1"_n;
    s.coopactor = username; // Представитель кооператива, который принял имущество
  });
} 