/**
\ingroup public_actions
\brief Заказчик принимает предложение из запасов кооператива.

@details Заказчик блокирует средства и запрашивает возврат.
Поскольку имущество уже на балансе — авторизация взноса не нужна,
сразу создаётся заявление на возврат в совет.

@param coopname Имя кооператива
@param username Имя заказчика
@param request_hash Хэш заявки
@param convert_in Заявление на конвертацию из кошелька
@param return_statement Заявление на возврат паевого взноса имуществом

@note Авторизация требуется от аккаунта: @p coopname
**/
[[eosio::action]] void marketplace::acceptstock(eosio::name coopname, eosio::name username, checksum256 request_hash, document2 convert_in, document2 return_statement) {
  require_auth(coopname);
  
  requests_index requests(_marketplace, coopname.value);
  auto change_opt = Marketplace::get_request_by_hash(coopname, request_hash);
  eosio::check(change_opt.has_value(), "Заявка не найдена");
  auto change = change_opt.value();
  
  eosio::check(change.type == "coopstock"_n, "Метод acceptstock применим только к заявкам типа coopstock");
  eosio::check(change.status == "delivered"_n, "Только доставленная заявка может быть принята");
  
  get_participant_or_fail(coopname, username);
  
  verify_document_or_fail(convert_in);
  verify_document_or_fail(return_statement);

  auto change_itr = requests.find(change.id);
  eosio::check(change_itr != requests.end(), "Заявка не найдена для обновления");
  
  requests.modify(change_itr, _marketplace, [&](auto &o) {
    o.money_contributor = username;
    o.status = "reqreturn"_n;
    Document::add_document(o.documents, DocumentNames::CONVERT_FROM, convert_in);
    Document::add_document(o.documents, DocumentNames::RETURN_STMT, return_statement);
  });

  // Блокируем средства заказчика
  std::string memo = "Блокировка средств для заказа из запасов кооператива №" + std::to_string(change.id);
  Wallet::sub_available_funds(_marketplace, coopname, username, change.total_cost, _wallet_program, memo);
  Wallet::add_available_funds(_marketplace, coopname, username, change.total_cost, _marketplace_program, memo);
  Wallet::block_funds(_marketplace, coopname, username, change.total_cost, _marketplace_program, memo);

  // Сразу отправляем заявление на возврат в совет
  ::Soviet::create_agenda(
    _marketplace,
    coopname,
    username,
    get_valid_soviet_action("authreturn"_n),
    change.hash,
    _marketplace,
    Marketplace::get_valid_marketplace_action("authreturn"_n),
    "declineacc"_n,
    return_statement,
    std::string("")
  );
}; 
