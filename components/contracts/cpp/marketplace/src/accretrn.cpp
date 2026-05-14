/**
 * @brief Председатель принимает гарантийный возврат на очном осмотре (Story 7.4, p.mkt.return).
 *
 * Композитная транзакция (атомарно):
 *  - Ledger2::apply(o.mkt.return,  fact_cost, orderer, hash=request.hash)  — Дт 91 / Кт 86, ISSUE w.mkt.member.
 *  - Ledger2::apply(o.mkt.return2, fact_cost, orderer, hash=request.hash)  — Дт 10 / Кт 91, NONE.
 *
 * Compensating forward, не revert (L3-AR14): новое событие в journal с
 * `original_consume_op_id` ссылкой на оригинальный o.mkt.consum (см. d6 A4).
 * Order.return_request_id очищается? Нет — оставляем для трассировки.
 *
 * Status: approved_for_visit → return_accepted (final). Имущество возвращается
 * на склад КУ; средства восстанавливаются на w.mkt.member.available заказчика.
 *
 * Guards:
 *  - actor == return_request.ku_chairman.
 *  - return_request.status == approved_for_visit.
 *
 * @ingroup public_marketplace_actions
 *
 * TODO Story 11.1 (Шаг 5): полная реализация.
 */
void marketplace::accretrn(eosio::name coopname,
                            eosio::name chairman,
                            checksum256 request_hash,
                            document2 decision) {
  require_auth(coopname);
  eosio::check(false, "TODO Story 11.1 Шаг 5: accretrn ещё не реализован");
}
