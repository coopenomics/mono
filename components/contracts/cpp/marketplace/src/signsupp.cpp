/**
 * @brief Поставщик первой подписью на АПП приёмки подтверждает передачу партии (Story 5.3/5.4).
 *
 * Без ledger2-операций (имущество физически на складе, но юридически не оприходовано
 * до signchair). Для каждого order: статус ship_ready → supply_prepared, документ
 * acceptance_act_signsupp сохраняется.
 *
 * Guards:
 *  - actor == offerer для всех orders.
 *  - Все orders в ship_ready.
 *  - verify_document_or_fail(act, {offerer}) — поставщик подписал.
 *  - Idempotency: повторный вызов запрещён (acceptance_act_signsupp != ∅ check).
 *
 * @ingroup public_marketplace_actions
 *
 * TODO Story 11.1 (Шаг 4): полная реализация.
 */
void marketplace::signsupp(eosio::name coopname,
                            eosio::name offerer,
                            checksum256 batch_hash,
                            std::vector<checksum256> order_hashes,
                            document2 act) {
  require_auth(coopname);
  eosio::check(false, "TODO Story 11.1 Шаг 4: signsupp ещё не реализован");
}
