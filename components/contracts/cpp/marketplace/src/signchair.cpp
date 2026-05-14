/**
 * @brief Председатель ставит закрывающую подпись АПП приёмки (Story 5.3/5.4, signchair).
 *
 * Per-Order композитная транзакция (атомарно):
 *  - Ledger2::apply(o.mkt.purch, total_cost, …, hash=order.hash) — Дт 10 / Кт 86.
 *  - Ledger2::apply(o.mkt.payout, total_cost, …, hash=order.hash) — Дт 86 / Кт 51.
 *
 * Для каждого order: статус supply_prepared → accepted_to_coop;
 * acceptance_act_signchair сохраняется; received_to_coop_at = now().
 *
 * Guards (L1, L2 — порядок подписей АПП и payout pattern):
 *  - actor — председатель того КУ, который принимает поставку (для всех orders
 *    проверка `actor == order.ku_chairman`).
 *  - Все orders в supply_prepared.
 *  - На акте есть подпись signsupp + chairman: verify_document_or_fail(act, {offerer, chairman}).
 *
 * @ingroup public_marketplace_actions
 *
 * TODO Story 11.1 (Шаг 4): полная реализация.
 */
void marketplace::signchair(eosio::name coopname,
                             eosio::name chairman,
                             checksum256 batch_hash,
                             std::vector<checksum256> order_hashes,
                             document2 act) {
  require_auth(coopname);
  eosio::check(false, "TODO Story 11.1 Шаг 4: signchair ещё не реализован");
}
