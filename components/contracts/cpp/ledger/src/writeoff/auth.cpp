/**
 * @brief Авторизация операции после положительного решения совета
 * @param coopname - имя кооператива
 * @param writeoff_hash - хэш операции списания
 */
[[eosio::action]]
void ledger::auth(eosio::name coopname, checksum256 writeoff_hash) {
  require_auth(_soviet);

  auto writeoff_opt = get_writeoff_by_hash(writeoff_hash);
  eosio::check(writeoff_opt.has_value(), "Операция не найдена");
  
  auto writeoff = writeoff_opt.value();
  eosio::check(writeoff.coopname == coopname, "Неверный кооператив");
  eosio::check(writeoff.status == "pending"_n, "Операция уже обработана");
        
  // Обновляем статус операции
  writeoffs_index writeoffs(_ledger, _ledger.value);
  auto writeoff_iter = writeoffs.find(writeoff.id);
  writeoffs.modify(writeoff_iter, _soviet, [&](auto& w) {
    w.status = "approved"_n;
  });

  // Отправляем запрос на создание исходящего платежа в gateway через интерфейс
  Action::send<createoutpay_interface>(
    _gateway,
    "createoutpay"_n,
    _ledger,
    coopname,
    writeoff.username,
    writeoff_hash,
    writeoff.quantity,
    _ledger, // callback_contract
    "complete"_n, // confirm_callback
    "decline"_n   // decline_callback
  );
} 