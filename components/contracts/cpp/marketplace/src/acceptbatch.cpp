/**
 * @brief Поставщик акцептует консолидированную заявку (Story 4.5, p.mkt.supply).
 *
 * Без ledger2-операций (L10: batch — backend-only). Контракт для каждого
 * order в batch'е переводит статус active → accepted и записывает batch_hash.
 *
 * Guards:
 *  - actor совпадает с order.offerer для всех orders в batch'е.
 *  - Все orders в active.
 *
 * @ingroup public_marketplace_actions
 *
 * TODO Story 11.1 (Шаг 4): полная реализация.
 */
void marketplace::acceptbatch(eosio::name coopname,
                               eosio::name offerer,
                               checksum256 batch_hash,
                               std::vector<checksum256> order_hashes) {
  require_auth(coopname);
  eosio::check(false, "TODO Story 11.1 Шаг 4: acceptbatch ещё не реализован");
}
