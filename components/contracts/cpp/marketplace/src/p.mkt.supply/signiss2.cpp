/**
 * @brief Заказчик закрывающей подписью АПП-выдачи получает имущество (Story 6.3, signiss2).
 *
 * Per-Order атомарная транзакция с поддержкой actual_quantity ≠ ordered (Story 6.2):
 *
 * 1) actual == ordered:
 *      Ledger2::apply(o.mkt.consum,  fact_cost) — Дт 91 / Кт 10, REVOKE на blocked.
 *      Ledger2::apply(o.mkt.consum2, fact_cost) — Дт 86 / Кт 91, NONE.
 *
 * 2) actual < ordered (выдано меньше — остаток на blocked возвращается):
 *      Ledger2::apply(o.mkt.unblk, ordered_cost - fact_cost) — снятие резерва на разницу.
 *      затем — те же consum + consum2 на fact_cost.
 *
 * 3) actual > ordered (доплата с паевого):
 *      diff = fact_cost - ordered_cost
 *      L6 guard на достаточность средств для diff (через w.wal.share + w.wal.member).
 *      Conditional o.wal.conv (если на w.wal.member недостача).
 *      Conditional o.mkt.assign (если на w.mkt.member недостача).
 *      o.mkt.block(diff) — резервируем доплату на этот же Order.
 *      затем — consum + consum2 на fact_cost.
 *
 * Status: ready_to_receive → received. actual_quantity, fact_cost,
 * issue_act_signiss2, received_at, warranty_until заполняются.
 *
 * Guards (L1, L6):
 *  - actor == order.orderer.
 *  - Order в ready_to_receive.
 *  - verify_document_or_fail(act, {ku_chairman, orderer}).
 *  - actual_quantity > 0.
 *  - При actual > ordered и нехватке средств — транзакция фейлится (L6).
 *  - Idempotency: is_empty_document(issue_act_signiss2).
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::signiss2(eosio::name coopname,
                            eosio::name orderer,
                            checksum256 order_hash,
                            uint64_t actual_quantity,
                            document2 act) {
  require_auth(coopname);
  eosio::check(actual_quantity > 0, "signiss2: actual_quantity должно быть > 0");

  auto o = Marketplace::get_order_by_hash_or_fail(coopname, order_hash);
  eosio::check(o.orderer == orderer,
               "signiss2: вы не заказчик этого Order'а");
  eosio::check(o.status == OrderStatus::READY_TO_RECEIVE,
               "signiss2: Order не в ready_to_receive");
  eosio::check(is_empty_document(o.issue_act_signiss2),
               "signiss2: финальная подпись АПП-выдачи уже зафиксирована (idempotency)");

  verify_document_or_fail(act, { o.ku_chairman, orderer });

  const eosio::asset fact_cost = eosio::asset(
      static_cast<int64_t>(actual_quantity) * o.unit_price.amount,
      _root_govern_symbol);
  eosio::check(fact_cost.amount > 0, "signiss2: fact_cost overflow или ноль");

  const std::string memo = "signiss2 p.mkt.supply";

  // ── Корректирующие операции (если факт ≠ заказ) ─────────────────────
  if (fact_cost < o.total_cost) {
    // actual < ordered: возвращаем разницу с blocked → available
    const eosio::asset diff = o.total_cost - fact_cost;
    Ledger2::apply(_marketplace, coopname,
                   operations::marketplace::UNBLOCK_ON_CANCEL,
                   diff, orderer, o.hash, memo + " (correction <)");

  } else if (fact_cost > o.total_cost) {
    // actual > ordered: добираем разницу с паевого + assign + block
    const eosio::asset diff = fact_cost - o.total_cost;

    // L6 guard на доступность diff в трёх кошельках
    auto bal_share  = Marketplace::get_user_wallet_balance(
        coopname, ledger2_wallets::SHARE_FUND_PAY, orderer);
    auto bal_member = Marketplace::get_user_wallet_balance(
        coopname, ledger2_wallets::CK_MEMBER, orderer);
    auto bal_mkt    = Marketplace::get_user_wallet_balance(
        coopname, ledger2_wallets::MARKETPLACE_MEMBER, orderer);

    eosio::asset total_avail = bal_share.available + bal_member.available + bal_mkt.available;
    eosio::check(total_avail >= diff,
                 std::string{"signiss2: недостаточно средств для доплаты разницы факт-заказ — нужно "} +
                   diff.to_string() + ", доступно " + total_avail.to_string() +
                   " (Locked Decision L6)");

    const eosio::asset zero = eosio::asset(0, _root_govern_symbol);
    eosio::asset need_to_assign = (bal_mkt.available >= diff)
                                   ? zero
                                   : (diff - bal_mkt.available);
    eosio::asset need_to_conv   = (bal_member.available >= need_to_assign)
                                   ? zero
                                   : (need_to_assign - bal_member.available);

    if (need_to_conv.amount > 0) {
      Ledger2::apply(_marketplace, coopname,
                     operations::wallet::CONVERT_TO_MEMBER,
                     need_to_conv, orderer, o.hash, memo + " (correction > conv)");
    }
    if (need_to_assign.amount > 0) {
      Ledger2::apply(_marketplace, coopname,
                     operations::marketplace::ASSIGN_TO_PROGRAM,
                     need_to_assign, orderer, o.hash, memo + " (correction > assign)");
    }
    Ledger2::apply(_marketplace, coopname,
                   operations::marketplace::BLOCK_FOR_ORDER,
                   diff, orderer, o.hash, memo + " (correction > block)");
  }
  // fact == ordered — без корректировок

  // ── Композитная пара consum + consum2 на fact_cost ──────────────────
  Ledger2::apply(_marketplace, coopname,
                 operations::marketplace::CONSUME_BY_MEMBER,
                 fact_cost, orderer, o.hash, memo);
  Ledger2::apply(_marketplace, coopname,
                 operations::marketplace::CONSUME_TRANSIT_CLOSE,
                 fact_cost, orderer, o.hash, memo);

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
