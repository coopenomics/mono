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
                             uint64_t actual_quantity,
                             std::string reason_text,
                             std::vector<checksum256> photos,
                             document2 statement) {
  require_auth(coopname);

  eosio::check(actual_quantity > 0, "Возвращаемое количество должно быть больше нуля");
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
  eosio::check(actual_quantity <= o.actual_quantity,
               "Нельзя вернуть больше единиц, чем было выдано");
  eosio::check(o.warranty_period_secs > 0,
               "По этому заказу гарантия не предусмотрена");

  const auto now = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());
  eosio::check(now < o.warranty_until,
               "Гарантийный срок по заказу истёк");

  const eosio::asset fact_cost = eosio::asset(
      static_cast<int64_t>(actual_quantity) * o.unit_price.amount,
      _root_govern_symbol);

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
                                       o.hash, statement);
}
