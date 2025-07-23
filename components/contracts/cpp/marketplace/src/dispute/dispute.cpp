/**
\ingroup public_actions
\brief Открытие гарантийного спора по заявке.

@details Заказчик может открыть спор после получения товара, если есть проблемы с качеством или соответствием. Спор создает специальные сегменты для возврата товара и получения компенсации.

@param coopname Имя кооператива
@param username Имя заказчика, открывающего спор
@param request_hash Хэш заявки, по которой открывается спор
@param document Документ с описанием претензии

@note Авторизация требуется от аккаунта: @p coopname
**/
[[eosio::action]] void marketplace::dispute(eosio::name coopname, eosio::name username, checksum256 request_hash, document2 document){

  require_auth(coopname);
    
  requests_index requests(_marketplace, coopname.value);
  auto change_opt = Marketplace::get_request_by_hash(coopname, request_hash);
  eosio::check(change_opt.has_value(), "Заявка не найдена");
  auto change = change_opt.value();
  
  eosio::check(change.type == "order"_n, "Спор может быть открыт только по заявке на поставку");
  eosio::check(change.username == username, "Только заказчик может открыть спор");
  eosio::check(change.is_warranty_return == false, "Нельзя открыть спор на спор");

  auto parent_change_opt = Marketplace::get_request_by_hash(coopname, change.parent_hash);
  eosio::check(parent_change_opt.has_value(), "Родительская заявка не найдена");
  auto parent_change = parent_change_opt.value();

  eosio::check(change.status == "received2"_n, "Неверный статус для открытия спора");
  
  // Проверяем подпись документа
  verify_document_or_fail(document);

  // Обновляем статус заявки на "disputed"
  auto change_itr = requests.find(change.id);
  eosio::check(change_itr != requests.end(), "Заявка не найдена для обновления");
  requests.modify(change_itr, _marketplace, [&](auto &e){
    e.status = "disputed"_n;
    e.disputed_at = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());
    e.is_warranty_return = true;
  });

  // Создаем сегмент для возврата товара от заказчика в кооператив
  uint64_t wreturn_segment_id = marketplace::create_segment(coopname, change.id, "wreturn"_n);
  
  // Создаем сегмент для выдачи товара из кооператива поставщику  
  uint64_t wsupply_segment_id = marketplace::create_segment(coopname, change.id, "wsupply"_n);

  // Сохраняем документ с претензией в wreturn сегменте
  marketplace::update_segment(coopname, wreturn_segment_id, [&](auto &s) {
    s.statement = document;
    s.status = "disputed"_n;
  });

  // Сохраняем документ с претензией в wsupply сегменте
  marketplace::update_segment(coopname, wsupply_segment_id, [&](auto &s) {
    s.statement = document;
    s.status = "disputed"_n;
  });

  // Используем хэш заявки как идентификатор пакета решений
  checksum256 agenda_hash = change.hash;

  // Отправляем заявление на гарантийный возврат в совет
  Action::send<createagenda_interface>(
    _soviet,
    "createagenda"_n,
    _marketplace,
    coopname,
    username,
    get_valid_soviet_action("mpwreturn"_n),
    agenda_hash,
    _marketplace,
    Marketplace::get_valid_marketplace_action("wauthorize"_n),
    "wdecline"_n,
    document,
    std::string("")
  );
}