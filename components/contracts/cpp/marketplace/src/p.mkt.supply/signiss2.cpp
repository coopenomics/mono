/**
 * @brief Заказчик закрывающей подписью АПП-выдачи получает имущество (Story 6.3, signiss2).
 *
 * Per-Order атомарная транзакция с поддержкой actual_quantity ≠ ordered (Story 6.2):
 *
 * 1) actual == ordered:
 *      Ledger2::apply(o.mkt.consum, fact_cost) — BURN w.mkt.order, Дт 86 / Кт 10
 *      (сжигание резерва заказа и выбытие имущества со склада через целевое
 *      финансирование).
 *
 * 2) actual < ordered (выдано меньше — остаток резерва возвращается):
 *      Ledger2::apply(o.mkt.unlock, ordered_cost - fact_cost) — TRANSFER w.mkt.order →
 *          w.wal.member на разницу (снятие части резерва на универсальный членский).
 *      затем — consum на fact_cost.
 *
 * 3) actual > ordered (доплата с паевого):
 *      diff = fact_cost - ordered_cost
 *      проверка достаточности средств для diff на w.wal.share.
 *      o.mkt.lock(diff) — TRANSFER w.wal.share → w.mkt.order, Дт 80 / Кт 86 —
 *      добор резерва на этот же Order. Затем — consum на fact_cost.
 *
 * Status: ready_to_receive → received. actual_quantity, fact_cost,
 * issue_act_signiss2, warranty_until заполняются.
 *
 * Guards:
 *  - actor == order.orderer; Order в ready_to_receive.
 *  - Подписант со стороны кооператива (`delivery_signer`) авторизован для
 *    КУ выдачи (`o.delivery_braname`).
 *  - verify_document_or_fail(act, {delivery_signer, orderer}).
 *  - actual_quantity > 0.
 *  - При actual > ordered и нехватке средств — транзакция фейлится с
 *    человеческим сообщением, которое UI показывает напрямую.
 *  - Idempotency: is_empty_document(issue_act_signiss2).
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::signiss2(eosio::name coopname,
                            eosio::name orderer,
                            checksum256 order_hash,
                            uint64_t actual_quantity,
                            eosio::name delivery_signer,
                            document2 act) {
  require_auth(coopname);
  eosio::check(actual_quantity > 0, "Фактическое количество должно быть больше нуля");

  auto o = Marketplace::get_order_by_hash_or_fail(coopname, order_hash);
  eosio::check(o.orderer == orderer, "Вы не заказчик этого заказа");
  eosio::check(o.status == OrderStatus::READY_TO_RECEIVE,
               "Заказ не готов к выдаче");
  eosio::check(is_empty_document(o.issue_act_signiss2),
               "Финальная подпись акта выдачи уже зафиксирована");

  auto branch = get_branch_or_fail(coopname, o.delivery_braname);
  eosio::check(branch.is_user_authorized(delivery_signer),
               "Подписант со стороны кооператива не уполномочен подписывать акты выдачи данного кооперативного участка");

  verify_document_or_fail(act, { delivery_signer, orderer });

  const eosio::asset fact_cost = eosio::asset(
      static_cast<int64_t>(actual_quantity) * o.unit_price.amount,
      _root_govern_symbol);
  eosio::check(fact_cost.amount > 0,
               "Итоговая фактическая сумма заказа должна быть больше нуля");

  // ── Корректирующие операции (если факт ≠ заказ) ─────────────────────
  if (fact_cost < o.total_cost) {
    // actual < ordered: снимаем разницу резерва → .available универсального членского
    const eosio::asset diff = o.total_cost - fact_cost;
    Ledger2::apply(_marketplace, coopname,
                   operations::marketplace::UNLOCK_ORDER,
                   diff, orderer, o.hash,
                   Marketplace::Memo::get_signiss2_correction_less_memo(o.id));

  } else if (fact_cost > o.total_cost) {
    // actual > ordered: добираем разницу с паевого через дополнительный lock
    const eosio::asset diff = fact_cost - o.total_cost;

    // Проверка доступности diff на паевом заказчика
    auto bal_share = Marketplace::get_user_wallet_balance(
        coopname, ledger2_wallets::SHARE_FUND_PAY, orderer);
    eosio::check(bal_share.available >= diff,
                 std::string{"Недостаточно средств для дооплаты по факту: требуется "} +
                   diff.to_string() + ", доступно " + bal_share.available.to_string());

    Ledger2::apply(_marketplace, coopname,
                   operations::marketplace::LOCK_ORDER,
                   diff, orderer, o.hash,
                   Marketplace::Memo::get_signiss2_correction_more_block_memo(o.id));
  }
  // fact == ordered — без корректировок

  // ── o.mkt.consum на fact_cost (BURN w.mkt.order, Дт 86 / Кт 10) ──────
  Ledger2::apply(_marketplace, coopname,
                 operations::marketplace::CONSUME_BY_MEMBER,
                 fact_cost, orderer, o.hash,
                 Marketplace::Memo::get_consume_by_member_memo(o.id));

  // ── Закрытие Order'а ────────────────────────────────────────────────
  const auto now = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());
  const auto warranty_until = (o.warranty_period_secs > 0)
      ? eosio::time_point_sec(now.sec_since_epoch() + o.warranty_period_secs)
      : eosio::time_point_sec(0);

  Marketplace::update_order(coopname, o.id, [&](auto& upd) {
    upd.status              = OrderStatus::RECEIVED;
    upd.actual_quantity     = actual_quantity;
    upd.fact_cost           = fact_cost;
    upd.issue_act_signiss2  = act;
    upd.warranty_until      = warranty_until;
  });
}
