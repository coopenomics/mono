/**
 * @brief Поставщик собирает партию к отгрузке (Story 5.1, p.mkt.supply).
 *
 * Без ledger2-операций. Для каждого order: статус accepted → ship_ready;
 * shipping_method (variant_a == самовывоз | variant_b == экспедитор) хранится
 * на батч-уровне — поскольку batch off-chain (L10), shipping_method
 * фиксируется на каждом order в составе batch_hash группировки.
 *
 * Guards (FR18a, hard accept):
 *  - actor == offerer для всех orders.
 *  - Все orders в accepted.
 *  - Состав ровно как акцептованный (контракт верит составу order_hashes;
 *    backend pre-validates).
 *
 * @ingroup public_marketplace_actions
 *
 * TODO Story 11.1 (Шаг 4): полная реализация.
 */
void marketplace::prepship(eosio::name coopname,
                            eosio::name offerer,
                            checksum256 batch_hash,
                            std::vector<checksum256> order_hashes,
                            eosio::name shipping_method) {
  require_auth(coopname);
  eosio::check(false, "TODO Story 11.1 Шаг 4: prepship ещё не реализован");
}
