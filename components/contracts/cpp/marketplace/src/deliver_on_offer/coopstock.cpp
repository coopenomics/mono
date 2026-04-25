/**
\ingroup public_actions
\brief Создать заявку на имущество из запасов кооператива.

@details Кооператив (представитель КУ) создаёт предложение на имущество,
которое УЖЕ находится на балансе кооператива. В этом случае:
- Не требуется внешний поставщик
- Не требуется взнос имуществом (имущество уже на балансе)
- Не требуется авторизация взноса советом
- Требуется только авторизация возврата при получении заказчиком

Заявка создаётся со статусом supplied2 (имущество уже на складе КУ).
Это упрощённый путь для реализации уценённого или перепредложенного имущества.

@param coopname Имя кооператива
@param braname КУ, где хранится имущество
@param units Количество единиц
@param unit_cost Стоимость за единицу (может быть уценённой)
@param hash Хэш заявки
@param product_lifecycle_secs Срок годности
@param warranty_period_secs Гарантийный срок
@param membership_fee_amount Членский взнос
@param meta Метаданные (описание, фото)

@note Авторизация требуется от аккаунта: @p coopname
**/
[[eosio::action]] void marketplace::coopstock(eosio::name coopname, eosio::name braname, checksum256 hash, uint64_t units, eosio::asset unit_cost, uint32_t product_lifecycle_secs, uint32_t warranty_period_secs, eosio::asset membership_fee_amount, std::string meta) {
  require_auth(coopname);
  
  auto existing = get_request_by_hash(coopname, hash);
  eosio::check(!existing.has_value(), "Заявка с таким хэшем уже существует");

  auto coop = get_cooperative_or_fail(coopname);
  eosio::check(unit_cost.symbol == coop.initial.symbol, "Неверный символ токена");
  eosio::check(membership_fee_amount.symbol == coop.initial.symbol, "Неверный символ токена для членского взноса");
  eosio::check(units > 0, "Количество единиц должно быть больше нуля");
  
  get_branch_or_fail(coopname, braname);

  eosio::asset base_cost = unit_cost * units;
  eosio::asset total_cost = base_cost + membership_fee_amount;
  eosio::asset zero_fee = eosio::asset(0, coop.initial.symbol);

  requests_index requests(_marketplace, coopname.value);
  uint64_t request_id = get_global_id(_marketplace, "requests"_n);

  requests.emplace(_marketplace, [&](auto &i) {
    i.id = request_id;
    i.hash = hash;
    i.type = "coopstock"_n;
    i.username = coopname;
    i.coopname = coopname;
    i.status = "delivered"_n;
    i.units = units;
    i.unit_cost = unit_cost;
    i.base_cost = base_cost;
    i.membership_fee_amount = membership_fee_amount;
    i.total_cost = total_cost;
    i.product_lifecycle_secs = product_lifecycle_secs;
    i.warranty_period_secs = warranty_period_secs;
    i.money_contributor = ""_n;
    i.product_contributor = coopname;
    i.meta = meta;
    i.created_at = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());
    i.supplied_at = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());
    i.delivered_at = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());
    i.cancellation_fee_amount = zero_fee;
    i.receiver_braname = braname;
    i.supplier_braname = braname;
    i.warehouse = braname;
  });
}; 
