/**
\ingroup public_actions
\brief Авторизация сегмента "s2c" для направления deliver_on_order (authords2c).

@details Метод используется для подтверждения согласия совета на заявление на взнос имуществом в направлении ORDER → OFFER.
Заявка становится авторизованной только когда оба сегмента (contribute и return) получили авторизацию.

@param coopname Имя кооператива
@param request_hash Хэш встречной заявки на обмен (offer)
@param authorization Документ авторизации

@note Авторизация требуется от аккаунта: @p _soviet
*/
[[eosio::action]] void marketplace::authords2c(eosio::name coopname, checksum256 request_hash, document2 authorization) {
  require_auth(_soviet);

  requests_index requests(_marketplace, coopname.value);
  auto change_opt = Marketplace::get_request_by_hash(coopname, request_hash);
  eosio::check(change_opt.has_value(), "Заявка не найдена");
  auto change = change_opt.value();

  eosio::check(change.type == "offer"_n, "Метод authords2c применим только к заявкам типа offer");
  eosio::check(change.parent_id > 0, "У встречной заявки должна быть родительская заявка");
  
  auto parent_change_opt = Marketplace::get_request_by_hash(coopname, change.parent_hash);
  eosio::check(parent_change_opt.has_value(), "Родительская заявка не найдена");
  auto parent_change = parent_change_opt.value();
  
  eosio::check(parent_change.type == "order"_n, "Родительская заявка должна быть типа order");
  
  // Обновляем contribute сегмент
  marketplace::update_segment_by_request_and_type(coopname, change.id, marketplace::valid_segment("s2c"), [&](auto &s) {
    s.authorization = authorization;
    s.status = "authorized"_n;
  });

  // Проверяем статусы обоих сегментов
  auto s2c_segment = marketplace::get_segment_by_request_and_type(coopname, change.id, marketplace::valid_segment("s2c"));
  auto c2r_segment = marketplace::get_segment_by_request_and_type(coopname, change.id, marketplace::valid_segment("c2r"));

  // Если оба сегмента авторизованы, авторизуем заявку
  if (s2c_segment.status == "authorized"_n && c2r_segment.status == "authorized"_n) {
    auto change_itr = requests.find(change.id);
    eosio::check(change_itr != requests.end(), "Встречная заявка не найдена для обновления");
    requests.modify(change_itr, _soviet, [&](auto &o) { 
      o.status = "authorized"_n; 
    });
  }
} 