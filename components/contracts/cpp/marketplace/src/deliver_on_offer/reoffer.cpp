/**
\ingroup public_actions
\brief Перепредложение непринятого имущества по пути coopstock.

@details Если заказчик не получил имущество в срок, но срок годности ещё не истёк,
председатель КУ может перепредложить его другим пайщикам. Это создаёт новую заявку
типа coopstock на основе текущей, с возможностью изменения цены.

Текущая заявка закрывается (средства возвращаются заказчику за вычетом штрафа),
создаётся новая заявка coopstock.

@param coopname Имя кооператива
@param request_hash Хэш текущей заявки
@param new_hash Хэш новой заявки
@param new_unit_cost Новая цена за единицу (может быть уценена)
@param new_meta Новые метаданные

@note Авторизация требуется от аккаунта: @p coopname
**/
[[eosio::action]] void marketplace::reoffer(eosio::name coopname, checksum256 request_hash, checksum256 new_hash, eosio::asset new_unit_cost, std::string new_meta) {
  require_auth(coopname);
  
  requests_index requests(_marketplace, coopname.value);
  auto change_opt = Marketplace::get_request_by_hash(coopname, request_hash);
  eosio::check(change_opt.has_value(), "Заявка не найдена");
  auto change = change_opt.value();
  
  eosio::check(
    change.status == "delivered"_n || change.status == "supplied2"_n,
    "Перепредложение возможно только для доставленного имущества"
  );
  
  auto coop = get_cooperative_or_fail(coopname);
  eosio::check(new_unit_cost.symbol == coop.initial.symbol, "Неверный символ токена");
  
  // Возврат средств заказчику за вычетом штрафа (если заказчик был)
  if (change.money_contributor.value != 0) {
    eosio::asset refund = change.total_cost - change.cancellation_fee_amount;
    
    if (refund.amount > 0) {
      std::string memo = "Возврат при перепредложении имущества по заявке №" + std::to_string(change.id);
      Wallet::unblock_funds(_marketplace, coopname, change.money_contributor, change.total_cost, _marketplace_program, memo);
      Wallet::sub_available_funds(_marketplace, coopname, change.money_contributor, change.total_cost, _marketplace_program, memo);
      Wallet::add_available_funds(_marketplace, coopname, change.money_contributor, refund, _wallet_program, memo);
    }
    
    if (change.cancellation_fee_amount.amount > 0) {
      eosio::action(
        eosio::permission_level{ _marketplace, "active"_n },
        _fund,
        "spreadamount"_n,
        std::make_tuple(coopname, change.cancellation_fee_amount)
      ).send();
    }
  }
  
  // Удаляем старую заявку
  auto change_itr = requests.find(change.id);
  requests.erase(change_itr);
  
  // Создаём новую заявку типа coopstock
  eosio::asset zero_fee = eosio::asset(0, coop.initial.symbol);
  eosio::asset new_base_cost = new_unit_cost * change.units;
  eosio::asset new_total_cost = new_base_cost + change.membership_fee_amount;
  
  auto new_existing = get_request_by_hash(coopname, new_hash);
  eosio::check(!new_existing.has_value(), "Заявка с новым хэшем уже существует");
  
  uint64_t new_id = get_global_id(_marketplace, "requests"_n);
  
  requests.emplace(_marketplace, [&](auto &i) {
    i.id = new_id;
    i.hash = new_hash;
    i.type = "coopstock"_n;
    i.username = coopname;
    i.coopname = coopname;
    i.status = "delivered"_n;
    i.units = change.units;
    i.unit_cost = new_unit_cost;
    i.base_cost = new_base_cost;
    i.membership_fee_amount = change.membership_fee_amount;
    i.total_cost = new_total_cost;
    i.product_lifecycle_secs = change.product_lifecycle_secs;
    i.warranty_period_secs = change.warranty_period_secs;
    i.money_contributor = ""_n;
    i.product_contributor = coopname;
    i.meta = new_meta;
    i.created_at = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());
    i.delivered_at = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());
    i.cancellation_fee_amount = zero_fee;
    i.receiver_braname = change.warehouse;
    i.supplier_braname = change.warehouse;
    i.warehouse = change.warehouse;
  });
}; 
