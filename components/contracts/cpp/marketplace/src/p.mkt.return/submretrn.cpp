/**
 * @brief Пайщик подаёт заявление на гарантийный возврат (Story 7.1, p.mkt.return).
 *
 * Без ledger2-операций. Создаётся return_request в pending_review;
 * order.return_request_id ставится для двусторонней связи. Привязка к
 * конкретному КУ не сохраняется — каждое последующее действие
 * (aprretrem/rejretrem/accretrn/rejretrn) принимает `braname` параметром
 * и валидирует его через `Branch::is_user_authorized`.
 *
 * Guards (из p.mkt.return.standard.yaml):
 *  - actor == original_order.orderer.
 *  - original_order.status == received.
 *  - original_order.warranty_until > now() (гарантийный срок не истёк, если
 *    warranty_period_secs > 0; иначе возврат запрещён).
 *  - photos.size() > 0 (фото приложены).
 *  - actual_quantity > 0 && <= original_order.actual_quantity.
 *  - request_hash уникален.
 *  - Active возврат на этот order ещё не открыт (idempotency через
 *    order.return_request_id == 0).
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::submretrn(eosio::name coopname,
                             eosio::name orderer,
                             checksum256 request_hash,
                             checksum256 original_order_hash,
                             eosio::asset actual_quantity,
                             std::string reason_text,
                             std::vector<checksum256> photos,
                             document2 statement) {
  require_auth(coopname);

  Marketplace::check_quantity(actual_quantity);
  eosio::check(!photos.empty(), "Приложите хотя бы одну фотографию товара");
  eosio::check(reason_text.size() > 0 && reason_text.size() <= 500,
               "Опишите причину возврата (от 1 до 500 символов)");

  eosio::check(!Marketplace::get_return_request_by_hash(coopname, request_hash).has_value(),
               "Заявление с таким идентификатором уже подано");

  auto o = Marketplace::get_order_by_hash_or_fail(coopname, original_order_hash);
  eosio::check(o.orderer == orderer,
               "Вы не заказчик исходного заказа");
  eosio::check(o.status == OrderStatus::RECEIVED,
               "Возврат возможен только по выданному заказу");
  eosio::check(o.return_request_id == 0,
               "По этому заказу уже открыто заявление на возврат");
  eosio::check(actual_quantity.symbol == o.actual_quantity.symbol,
               "Единица измерения возврата не совпадает с заказом");
  Marketplace::check_packaging(actual_quantity, o.package_size);  // Эпик 18: упаковочный — возвращаем целыми упаковками
  eosio::check(actual_quantity <= o.actual_quantity,
               "Нельзя вернуть больше единиц, чем было выдано");
  eosio::check(o.warranty_period_secs > 0,
               "По этому заказу гарантия не предусмотрена");

  const auto now = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());
  eosio::check(now < o.warranty_until,
               "Гарантийный срок по заказу истёк");

  // Стоимость возвращаемого имущества считается от ФАКТА выдачи, а не от цены
  // заказа: оператор мог скорректировать цену на месте (issueact2 берёт факт из
  // акта выдачи), и заказчик заплатил именно `o.fact_cost`. Расчёт от
  // `o.unit_price` вернул бы сумму, отличную от уплаченной, и разошёлся бы с
  // суммой в подписанном заявлении. Доля возвращаемого количества берётся той
  // же пропорцией, что и доля членского взноса ниже.
  eosio::check(o.actual_quantity.amount > 0,
               "По заказу не зафиксировано фактически выданное количество");
  const eosio::asset fact_cost =
      Marketplace::pro_rata(o.fact_cost, actual_quantity.amount, o.actual_quantity.amount);

  // Доля членского взноса, приходящаяся на возвращаемое имущество. Возврат —
  // полный: пайщику возвращается и стоимость имущества, и уплаченный за него
  // взнос, иначе гарантийный возврат обходился бы ему в размер взноса.
  //
  // База — взнос, фактически принятый кооперативом на выдаче: при недовыдаче
  // issueact2 пересчитал его пропорционально факту (излишек уже вернулся
  // пайщику через o.mkt.refund), поэтому здесь берём ту же пропорцию, а затем
  // масштабируем по доле возвращаемого количества. При возврате всего
  // выданного количества доля равна принятому взносу целиком.
  const eosio::asset locked_fee = Marketplace::get_order_membership_fee(o);
  eosio::asset fee_refund = eosio::asset(0, _root_govern_symbol);
  if (locked_fee.amount > 0 && o.total_cost.amount > 0) {
    // Ровно та же пропорция, что применил issueact2 при финализации взноса, —
    // возвращаем не больше и не меньше принятого участком.
    const eosio::asset accepted_fee =
        Marketplace::pro_rata(locked_fee, o.fact_cost.amount, o.total_cost.amount);
    fee_refund = Marketplace::pro_rata(accepted_fee, actual_quantity.amount,
                                       o.actual_quantity.amount);
  }

  // Часть возвращаемой стоимости, приходящаяся на членский резерв: та же
  // пропорция, что при выдаче (членский резерв гасился первым).
  const eosio::asset consumed_member = o.member_funded >= o.fact_cost ? o.fact_cost : o.member_funded;
  const eosio::asset member_return = o.fact_cost.amount > 0
      ? Marketplace::pro_rata(fact_cost, consumed_member.amount, o.fact_cost.amount)
      : eosio::asset(0, _root_govern_symbol);

  // Создание return_request entity
  return_requests_index requests(_marketplace, coopname.value);
  uint64_t request_id = requests.available_primary_key();
  requests.emplace(_marketplace, [&](auto& r) {
    r.id                    = request_id;
    r.hash                  = request_hash;
    r.coopname              = coopname;
    r.orderer               = orderer;
    r.original_order_id     = o.id;
    r.original_order_hash   = o.hash;
    // r.original_consume_op_id заполнит backend post-effect через ParserClient
    // (подбор по journal с process_hash=order.hash + operation_code=o.mkt.consum).
    r.actual_quantity       = actual_quantity;
    r.fact_cost             = fact_cost;
    r.fee_refund            = fee_refund;
    r.member_return         = member_return;
    r.reason_text           = reason_text;
    r.photos                = photos;
    r.status                = ReturnStatus::PENDING_REVIEW;
    r.statement             = statement;
  });

  // Двусторонняя связь — order.return_request_id
  Marketplace::update_order(coopname, o.id, [&](auto& upd) {
    upd.return_request_id = request_id;
  });

  // Заявление публикуется в реестр документов со статусом «подан» в пакете
  // процесса заказа (package = order_hash, рядом с актами приёма-передачи).
  // Итог рассмотрения доводит статус: accretrn → newresolved (со-подписанная
  // версия), rejretrn/rejretrem → newdeclined.
  Action::send<newsubmitted_interface>(_soviet, "newsubmitted"_n, _marketplace,
                                       coopname, orderer, "submretrn"_n,
                                       o.hash, statement, uint64_t(0));
}
