/**
\ingroup public_actions
\brief Уничтожение просроченного имущества.

@details Если имущество не получено заказчиком в срок (deadline_for_receipt)
и его срок годности истёк, кооператив может уничтожить его.
Требуется комиссионный акт и видео/фото подтверждение.

При уничтожении:
- Заблокированные средства заказчика разблокируются за вычетом cancellation_fee
- cancellation_fee зачисляется в фонд членских взносов
- Из фонда членских взносов поставщику выплачивается стоимость

@param coopname Имя кооператива
@param request_hash Хэш заявки
@param destruction_act Акт уничтожения имущества (с комиссией)

@note Авторизация требуется от аккаунта: @p coopname
**/
[[eosio::action]] void marketplace::destroy(eosio::name coopname, checksum256 request_hash, document2 destruction_act) {
  require_auth(coopname);
  
  requests_index requests(_marketplace, coopname.value);
  auto change_opt = Marketplace::get_request_by_hash(coopname, request_hash);
  eosio::check(change_opt.has_value(), "Заявка не найдена");
  auto change = change_opt.value();
  
  // Уничтожение возможно только для доставленного или непринятого имущества
  eosio::check(
    change.status == "delivered"_n || change.status == "supplied2"_n,
    "Уничтожение возможно только для доставленного/поставленного имущества"
  );
  
  // Проверяем что срок получения истёк (если был установлен)
  if (change.deadline_for_receipt.sec_since_epoch() > 0) {
    eosio::check(
      eosio::current_time_point().sec_since_epoch() > change.deadline_for_receipt.sec_since_epoch(),
      "Срок получения ещё не истёк"
    );
  }
  
  verify_document_or_fail(destruction_act);
  
  auto change_itr = requests.find(change.id);
  eosio::check(change_itr != requests.end(), "Заявка не найдена");
  
  // Возврат средств заказчику за вычетом штрафа
  if (change.money_contributor.value != 0) {
    eosio::asset refund = change.total_cost - change.cancellation_fee_amount;
    
    if (refund.amount > 0) {
      std::string memo = "Возврат за уничтоженное имущество по заявке №" + std::to_string(change.id);
      Wallet::unblock_funds(_marketplace, coopname, change.money_contributor, change.total_cost, _marketplace_program, memo);
      Wallet::sub_available_funds(_marketplace, coopname, change.money_contributor, change.total_cost, _marketplace_program, memo);
      Wallet::add_available_funds(_marketplace, coopname, change.money_contributor, refund, _wallet_program, memo);
    }
    
    // Штраф — в фонд членских взносов
    if (change.cancellation_fee_amount.amount > 0) {
      Wallet::add_member_fee(coopname, change.cancellation_fee_amount);
    }
  }
  
  // Выплата поставщику (если был)
  if (change.product_contributor.value != 0 && change.product_contributor != coopname) {
    std::string memo = "Выплата поставщику за уничтоженное имущество по заявке №" + std::to_string(change.id);
    Wallet::unblock_funds(_marketplace, coopname, change.product_contributor, change.base_cost, _marketplace_program, memo);
    Wallet::sub_available_funds(_marketplace, coopname, change.product_contributor, change.base_cost, _marketplace_program, memo);
    Wallet::add_available_funds(_marketplace, coopname, change.product_contributor, change.base_cost, _wallet_program, memo);
  }
  
  // Удаляем заявку
  requests.erase(change_itr);
}; 
