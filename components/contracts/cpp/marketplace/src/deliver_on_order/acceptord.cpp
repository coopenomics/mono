/**
\ingroup public_actions
\brief Подтверждение готовности выполнить заказ в направлении deliver_on_order (acceptord).

@details Данный метод позволяет поставщику, который получил заказ от заказчика, подтвердить свою готовность принять его и создать встречную заявку типа "offer". При этом поставщик подает два документа: заявление на взнос имуществом и заявление на конвертацию в цифровой кошелек.

Процесс: ORDER (parent) → OFFER (child)
- Parent: денежный паевой взнос (заказчик)
- Child: имущественный паевой взнос (поставщик)

@param coopname Имя кооператива
@param username Имя поставщика, подтверждающего готовность выполнить заказ
@param request_hash Хэш заявки, которую следует принять
@param contribution_document Заявление на взнос имуществом
@param conversion_document Заявление на конвертацию в цифровой кошелек
 
@note Авторизация требуется от аккаунта: @p coopname
*/
[[eosio::action]] void marketplace::acceptord(eosio::name coopname, eosio::name username, checksum256 request_hash, document2 contribution_document, document2 conversion_document) { 
  require_auth(coopname);
  
  requests_index requests(_marketplace, coopname.value);
  auto change_opt = Marketplace::get_request_by_hash(coopname, request_hash);
  eosio::check(change_opt.has_value(), "Заявка не найдена");
  auto change = change_opt.value();
  
  eosio::check(change.status == "active"_n, "Только активная заявка может быть принята");
  eosio::check(change.type == "offer"_n, "Метод orderaccept применим только к встречным заявкам типа offer");
  eosio::check(change.parent_id > 0, "У встречной заявки должна быть родительская заявка");

  auto parent_change_opt = Marketplace::get_request_by_hash(coopname, change.parent_hash);
  eosio::check(parent_change_opt.has_value(), "Родительская заявка не найдена");
  auto parent_change = parent_change_opt.value();
  
  eosio::check(parent_change.type == "order"_n, "Родительская заявка должна быть типа order");
  eosio::check(parent_change.username == username, "Недостаточно прав доступа");
  eosio::check(parent_change.remain_units >= change.remain_units, "Недостаточно объектов для поставки");
  
  // Проверяем подписи документов
  verify_document_or_fail(contribution_document);
  verify_document_or_fail(conversion_document);

  // Обновляем родительскую заявку (order)
  auto parent_itr = requests.find(parent_change.id);
  eosio::check(parent_itr != requests.end(), "Родительская заявка не найдена для обновления");
  requests.modify(parent_itr, _marketplace, [&](auto &i) {
    i.remain_units -= change.remain_units;
    i.supplier_amount = (parent_change.remain_units - change.remain_units) * parent_change.unit_cost;
    i.blocked_units += change.remain_units;
  });

  // Проверяем инварианты родительской заявки
  auto updated_parent = requests.find(parent_change.id);
  marketplace::check_units_invariant(*updated_parent, "orderaccept_parent_update");

  // Обновляем встречную заявку (offer)
  auto change_itr = requests.find(change.id);
  eosio::check(change_itr != requests.end(), "Встречная заявка не найдена для обновления");
  requests.modify(change_itr, _marketplace, [&](auto &o){
    o.status = "accepted"_n;
    o.blocked_units += change.remain_units;
    o.remain_units = 0;
    o.accepted_at = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());
  });
  
  // Проверяем инварианты дочерней заявки
  auto updated_change = requests.find(change.id);
  marketplace::check_units_invariant(*updated_change, "orderaccept_child_update");

  // Сохраняем заявление на конвертацию в contribute сегменте
  marketplace::update_segment_by_request_and_type(coopname, change.id, marketplace::valid_segment("s2c"), [&](auto &s) {
    s.statement = conversion_document;
    s.status = "statement"_n;
  });

  // Сохраняем заявление на возврат в return сегменте
  marketplace::update_segment_by_request_and_type(coopname, change.id, marketplace::valid_segment("c2r"), [&](auto &s) {
    s.statement = contribution_document;
    s.status = "statement"_n;
  });

  // Извлекаем заявления из сегментов
  auto s2c_segment = marketplace::get_segment_by_request_and_type(coopname, change.id, marketplace::valid_segment("s2c"));
  auto c2r_segment = marketplace::get_segment_by_request_and_type(coopname, change.id, marketplace::valid_segment("c2r"));

  // Используем хэш встречной заявки как идентификатор пакета решений
  checksum256 agenda_hash = change.hash;

  // Отправляем заявление на взнос имуществом (из contribute сегмента) в совет
  Action::send<createagenda_interface>(
    _soviet,
    "createagenda"_n,
    _marketplace,
    coopname,
    username,
    get_valid_soviet_action("mpcontrib"_n),
    agenda_hash,
    _marketplace,
    Marketplace::get_valid_marketplace_action("authordcont"_n),
    "declineacc"_n,
    s2c_segment.statement,
    std::string("")
  );

  // Отправляем заявление на конвертацию (из return сегмента) в совет
  Action::send<createagenda_interface>(
    _soviet,
    "createagenda"_n,
    _marketplace,
    coopname,
    username,
    get_valid_soviet_action("mpconvert"_n),
    agenda_hash,
    _marketplace,
    Marketplace::get_valid_marketplace_action("authordret"_n),
    "declineacc"_n,
    c2r_segment.statement,
    std::string("")
  );
} 