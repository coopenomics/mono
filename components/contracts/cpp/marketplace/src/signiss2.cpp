/**
 * @brief Заказчик закрывающей подписью АПП-выдачи получает имущество (Story 6.3, signiss2).
 *
 * Per-Order атомарная транзакция с поддержкой actual_quantity ≠ ordered (Story 6.2):
 *   1) Если actual < ordered:
 *        Ledger2::apply(o.mkt.unblk, (ordered-actual)*price, …) — снятие резерва на разницу.
 *   2) Если actual > ordered (доплата с паевого):
 *        Ledger2::apply(o.wal.conv, diff, …) — conditional, conv с паевого если на w.wal.member не хватает;
 *        Ledger2::apply(o.mkt.assign, diff, …) — conditional, assign в программу если на w.mkt.member не хватает;
 *        Ledger2::apply(o.mkt.block, diff, …) — block разницы под этот же order.
 *        Если средств не хватает — транзакция фейлится (Locked Decision L6).
 *   3) Всегда: Ledger2::apply(o.mkt.consum, fact_cost, …) + Ledger2::apply(o.mkt.consum2, fact_cost, …).
 *
 * Per-Order: статус ready_to_receive → received; actual_quantity, fact_cost,
 * issue_act_signiss2, received_at, warranty_until заполняются.
 *
 * Guards (L1, L6):
 *  - actor == order.orderer.
 *  - Order в ready_to_receive.
 *  - verify_document_or_fail(act, {chairman, orderer}).
 *  - actual_quantity > 0.
 *
 * @ingroup public_marketplace_actions
 *
 * TODO Story 11.1 (Шаг 4): полная реализация.
 */
void marketplace::signiss2(eosio::name coopname,
                            eosio::name orderer,
                            checksum256 order_hash,
                            uint64_t actual_quantity,
                            document2 act) {
  require_auth(coopname);
  eosio::check(false, "TODO Story 11.1 Шаг 4: signiss2 ещё не реализован");
}
