/**
 * @brief Пайщик подаёт заявление на гарантийный возврат (Story 7.1, p.mkt.return).
 *
 * Без ledger2-операций. Создаётся return_request в pending_review;
 * order.return_request_id ставится для двусторонней связи.
 *
 * Guards (из p.mkt.return.standard.yaml):
 *  - actor == original_order.orderer.
 *  - original_order.status == received.
 *  - original_order.warranty_until > now() (гарантийный срок не истёк).
 *  - photos.size() > 0 (фото приложены).
 *  - actual_quantity > 0 && actual_quantity <= original_order.actual_quantity.
 *
 * @ingroup public_marketplace_actions
 *
 * TODO Story 11.1 (Шаг 5): полная реализация.
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
  eosio::check(false, "TODO Story 11.1 Шаг 5: submretrn ещё не реализован");
}
