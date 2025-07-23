/**
\ingroup public_actions
\brief Подтверждение поставки председателем в направлении deliver_on_offer (supplcnfoff).

@details Председатель совета подтверждает поставку имущества и переводит статус заявки на "доставлено".

Процесс: OFFER (parent) → ORDER (child)
- Председатель подтверждает факт поставки имущества

@param coopname Имя кооператива
@param username Имя председателя
@param request_hash Хэш встречной заявки (order)
@param document Акт подтверждения поставки

@note Авторизация требуется от аккаунта: @p coopname
**/
[[eosio::action]] void marketplace::supplcnfoff(eosio::name coopname, eosio::name username, checksum256 request_hash, document2 document) {
  require_auth(coopname);

  requests_index requests(_marketplace, coopname.value);
  auto change_opt = Marketplace::get_request_by_hash(coopname, request_hash);
  eosio::check(change_opt.has_value(), "Заявка не найдена");
  auto change = change_opt.value();
  
  eosio::check(change.type == "order"_n, "Метод offersupplycnfrm применим только к заявкам типа order");
  eosio::check(change.parent_id > 0, "У встречной заявки должна быть родительская заявка");

  auto parent_change_opt = Marketplace::get_request_by_hash(coopname, change.parent_hash);
  eosio::check(parent_change_opt.has_value(), "Родительская заявка не найдена");
  auto parent_change = parent_change_opt.value();
  
  eosio::check(parent_change.type == "offer"_n, "Родительская заявка должна быть типа offer");

  eosio::check(change.status == "supplied"_n, "Подтверждение поставки возможно только в статусе supplied");

  auto branch = get_branch_or_fail(coopname, change.braname);
  
  //Проверяем права доступа на КУ (председатель или доверенное лицо)
  eosio::check(branch.is_user_authorized(username), "Недостаточно прав доступа для приёма имущества");
  
  // Проверяем подпись документа
  verify_document_or_fail(document);

  // Обновляем статус встречной заявки
  auto change_itr = requests.find(change.id);
  eosio::check(change_itr != requests.end(), "Встречная заявка не найдена для обновления");
  requests.modify(change_itr, _marketplace, [&](auto &o) { 
    o.status = "supplied2"_n;
    o.delivered_at = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());
    o.delivered_units = o.blocked_units;
    o.deadline_for_receipt = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch() + 3 * 24 * 60 * 60); // 3 дня на подтверждение
  });

  // Проверяем инварианты дочерней заявки
  auto updated_change = requests.find(change.id);
  marketplace::check_units_invariant(*updated_change, "offersupplycnfrm_child_update");

  // Сохраняем акт подтверждения поставки в contribute сегменте
  marketplace::update_segment_by_request_and_type(coopname, change.id, marketplace::valid_segment("s2c"), [&](auto &s) {
    s.act2 = document;
    s.status = "supplied2"_n;
  });
} 