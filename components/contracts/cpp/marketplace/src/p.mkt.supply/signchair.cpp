/**
 * @brief Председатель ставит закрывающую подпись АПП приёмки (Story 5.3/5.4, signchair).
 *
 * Per-Order композитная транзакция (атомарно в одной Antelope tx):
 *  - Ledger2::apply(o.mkt.purch,  total_cost, …, hash=order.hash) — Дт 10 / Кт 86.
 *  - Ledger2::apply(o.mkt.payout, total_cost, …, hash=order.hash) — Дт 86 / Кт 51.
 *
 * Каждый Order — отдельная пара (purch + payout) с собственным process_hash.
 * Имущество приходуется на склад КУ; поставщику уходит оплата на w.mkt.payout.
 *
 * Status: supply_prepared → accepted_to_coop. acceptance_act_signchair сохраняется,
 * received_to_coop_at = now() для всех orders в batch'е.
 *
 * Guards (L1, L2):
 *  - actor == order.ku_chairman для всех orders (председатель того КУ, который
 *    принимает поставку).
 *  - Все orders в supply_prepared.
 *  - На акте есть подпись signsupp + chairman: verify_document_or_fail(act, {offerer, chairman}).
 *    `offerer` берётся из первого order (все orders batch'а имеют общего offerer).
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::signchair(eosio::name coopname,
                             eosio::name chairman,
                             checksum256 batch_hash,
                             std::vector<checksum256> order_hashes,
                             document2 act) {
  require_auth(coopname);
  eosio::check(!order_hashes.empty(), "signchair: список order_hashes пуст");

  // Берём offerer из первого order'а — все orders batch'а имеют общего offerer
  // (acceptbatch fail'ится иначе).
  auto first = Marketplace::get_order_by_hash_or_fail(coopname, order_hashes[0]);
  verify_document_or_fail(act, { first.offerer, chairman });

  const std::string memo = "signchair p.mkt.supply";

  for (const auto& h : order_hashes) {
    auto o = Marketplace::get_order_by_hash_or_fail(coopname, h);
    eosio::check(o.ku_chairman == chairman,
                 "signchair: вы не председатель КУ выдачи одного из orders");
    eosio::check(o.status == OrderStatus::SUPPLY_PREPARED,
                 "signchair: один из orders не в supply_prepared");
    eosio::check(o.batch_hash == batch_hash,
                 "signchair: order не относится к указанному batch'у");

    // Композитная пара purch + payout (атомарно)
    Ledger2::apply(_marketplace, coopname,
                   operations::marketplace::PURCHASE_FROM_SUPPLIER,
                   o.total_cost, o.offerer, o.hash, memo);
    Ledger2::apply(_marketplace, coopname,
                   operations::marketplace::PAY_SUPPLIER,
                   o.total_cost, o.offerer, o.hash, memo);

    Marketplace::update_order(coopname, o.id, [&](auto& upd) {
      upd.status = OrderStatus::ACCEPTED_TO_COOP;
      upd.acceptance_act_signchair = act;
    });
  }
}
