/**
\ingroup public_actions
\brief Подтверждение поставки председателем КУ.

@details Председатель кооперативного участка или доверенное им лицо подтверждает факт поставки имущества.

@param coopname Имя кооператива
@param username Имя представителя кооператива
@param request_hash Хэш заявки
@param act Акт подтверждения поставки

@note Авторизация требуется от аккаунта: @p coopname
**/
[[eosio::action]] void marketplace::supplcnf(eosio::name coopname, eosio::name username, checksum256 request_hash, document2 act) {
  require_auth(coopname);
  
  requests_index requests(_marketplace, coopname.value);
  auto change_opt = Marketplace::get_request_by_hash(coopname, request_hash);
  eosio::check(change_opt.has_value(), "Заявка не найдена");
  auto change = change_opt.value();
  
  eosio::check(change.status == "supplied1"_n, "Поставка должна быть подтверждена после статуса supplied1");
  
  // Проверяем подпись документа
  verify_document_or_fail(act);
  
  // Валидируем документ по registry_id (пока что ноль)
  Document::validate_registry_id(act, 0);

  // Обновляем заявку
  auto change_itr = requests.find(change.id);
  eosio::check(change_itr != requests.end(), "Заявка не найдена для обновления");
  requests.modify(change_itr, _marketplace, [&](auto &o){
    o.status = "supplied2"_n;
    o.warehouse = change.supplier_braname; // Ставим имущество на склад КУ приёма
    o.supplied_at = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());
    // Добавляем акт подтверждения с именем
    Document::add_document(o.documents, DocumentNames::SUPPLY_ACT_CONF, act);
  });

  // Проводки по кошельку
  std::string memo = "Подтверждение поставки для заказа №" + std::to_string(change.id);
  
  // Паевой фонд - увеличиваем циркуляцию
  Ledger::add(_marketplace, coopname, Ledger::accounts::SHARE_FUND, change.total_cost, memo, request_hash, username);
  
  // Поставщик - начисляем и блокируем средства
  Wallet::add_available_funds(_marketplace, coopname, change.product_contributor, change.base_cost, _marketplace_program, memo);
  Wallet::block_funds(_marketplace, coopname, change.product_contributor, change.base_cost, _marketplace_program, memo);
}; 