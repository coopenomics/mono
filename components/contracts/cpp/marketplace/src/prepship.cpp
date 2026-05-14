/**
 * @brief Поставщик собирает партию к отгрузке (Story 5.1, p.mkt.supply).
 *
 * Без ledger2-операций. Для каждого order: статус accepted → ship_ready;
 * shipping_method (опциональная аналитика, проверяется только что валидное
 * значение из enum {variant_a == самовывоз, variant_b == через экспедитора}).
 * Сохранение shipping_method on-chain не требуется — backend знает per-batch.
 *
 * Guards (FR18a, hard accept):
 *  - actor == offerer для всех orders.
 *  - Все orders в accepted.
 *  - Состав ровно как акцептованный (контракт верит составу order_hashes;
 *    backend pre-validates через жёсткий check состава batch'а).
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::prepship(eosio::name coopname,
                            eosio::name offerer,
                            checksum256 batch_hash,
                            std::vector<checksum256> order_hashes,
                            eosio::name shipping_method) {
  require_auth(coopname);
  eosio::check(!order_hashes.empty(), "prepship: список order_hashes пуст");
  eosio::check(shipping_method == "varianta"_n || shipping_method == "variantb"_n,
               "prepship: shipping_method должен быть varianta (самовывоз) или variantb (экспедитор)");

  for (const auto& h : order_hashes) {
    auto o = Marketplace::get_order_by_hash_or_fail(coopname, h);
    eosio::check(o.offerer == offerer,
                 "prepship: вы не поставщик одного из orders в batch'е");
    eosio::check(o.status == OrderStatus::ACCEPTED,
                 "prepship: один из orders не в accepted");
    eosio::check(o.batch_hash == batch_hash,
                 "prepship: order не относится к указанному batch'у");

    Marketplace::update_order(coopname, o.id, [&](auto& upd) {
      upd.status = OrderStatus::SHIP_READY;
    });
  }
}
