/**
 * @brief Заказ имущества из обезличенного остатка склада кооператива
 * (requirement 76 «Склад кооператива на КУ», p.mkt.supply).
 *
 * Продавец — сам кооператив: имущество уже принято на склад по ранее
 * закрытым АПП приёмки (числится на счёте 10 после o.mkt.purch) и
 * перепредлагается пайщикам после недовыдачи / отказа от излишка.
 * Поэтому Order создаётся сразу в статусе `acceptcoop` — этапы поставки
 * (acceptorder / signsupp / signchair) и выплата поставщику (payout)
 * для него не существуют: дальше работает только штатная выдача
 * signiss1 → signiss2 (o.mkt.consum, Дт 86 / Кт 10).
 *
 * Маркер заказа из остатка — `order.offerer == coopname` (кооператив-продавец).
 * По нему `cancelorder` разрешает отмену в `acceptcoop` (откат оператора
 * до своей подписи), а `payout` отклоняет попытку выплаты.
 *
 * Одна ledger2-операция (как у createorder):
 *  - `o.mkt.lock` (TRANSFER w.wal.share → w.mkt.order на total_cost,
 *    Дт 80 / Кт 86) — паевой взнос заказчика резервируется под заказ
 *    в момент акцепта предложения (неакцептованное предложение докладки
 *    ничего не резервирует — requirement 76, решение 10).
 *
 * Guards (зеркало createorder + специфика остатка):
 *  - quantity > 0; unit_price > 0 в _root_govern_symbol (цена публикации
 *    остатка: цена прибытия либо уценка — requirement 76, решение 12).
 *  - Order с таким hash ещё не создан (idempotency).
 *  - Заказчик — активный пайщик кооператива.
 *  - `delivery_braname` существует: КУ, на складе которого лежит остаток;
 *    он же — КУ выдачи (`accept_braname` и `current_warehouse_braname`
 *    равны ему: имущество уже на месте, логистики нет).
 *  - w.wal.share.available заказчика >= total_cost (Locked Decision L6).
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::stockorder(eosio::name coopname,
                              eosio::name orderer,
                              checksum256 order_hash,
                              checksum256 offer_hash,
                              eosio::name delivery_braname,
                              uint64_t quantity,
                              eosio::asset unit_price,
                              uint32_t warranty_period_secs,
                              checksum256 batch_hash) {
  require_auth(coopname);

  // ── Базовая валидация параметров ────────────────────────────────────
  eosio::check(quantity > 0, "Количество должно быть больше нуля");
  eosio::check(unit_price.is_valid() && unit_price.amount > 0,
               "Некорректная цена за единицу");
  eosio::check(unit_price.symbol == _root_govern_symbol,
               "Некорректный символ валюты в цене");

  // Idempotency: Order с таким hash не должен существовать
  eosio::check(!Marketplace::get_order_by_hash(coopname, order_hash).has_value(),
               "Заказ с таким идентификатором уже создан");

  // Заказчик — активный пайщик кооператива (бросает если не найден / blocked)
  get_participant_or_fail(coopname, orderer);

  // КУ, на складе которого лежит остаток; он же — КУ выдачи
  get_branch_or_fail(coopname, delivery_braname);

  // ── Расчёт total_cost ────────────────────────────────────────────────
  eosio::asset total_cost = eosio::asset(
      static_cast<int64_t>(quantity) * unit_price.amount,
      _root_govern_symbol);
  eosio::check(total_cost.amount > 0,
               "Итоговая сумма заказа должна быть больше нуля");

  // ── Достаточность средств: w.wal.share.available >= total_cost ──────
  auto bal_share = Marketplace::get_user_wallet_balance(
      coopname, ledger2_wallets::SHARE_FUND_PAY, orderer);
  eosio::check(bal_share.available >= total_cost,
               std::string{"Недостаточно средств для заказа: требуется "} +
                 total_cost.to_string() + ", доступно " + bal_share.available.to_string());

  // ── Создание Order entity сразу в acceptcoop ─────────────────────────
  orders_index orders(_marketplace, coopname.value);
  uint64_t new_id = orders.available_primary_key();

  orders.emplace(_marketplace, [&](auto& o) {
    o.id              = new_id;
    o.hash            = order_hash;
    o.coopname        = coopname;
    o.orderer         = orderer;
    o.offerer         = coopname;          // маркер: продавец — кооператив
    o.offer_hash      = offer_hash;

    o.delivery_braname          = delivery_braname;
    o.accept_braname            = delivery_braname; // имущество уже на складе этого КУ
    o.current_warehouse_braname = delivery_braname;

    o.quantity        = quantity;
    o.actual_quantity = quantity;          // до signiss2 == quantity
    o.unit_price      = unit_price;
    o.total_cost      = total_cost;
    o.fact_cost       = total_cost;        // до signiss2 == total_cost

    o.warranty_period_secs = warranty_period_secs;

    o.status      = OrderStatus::ACCEPTED_TO_COOP; // имущество уже в кооперативе
    o.batch_hash  = batch_hash;
  });

  // ── o.mkt.lock: TRANSFER w.wal.share → w.mkt.order (Дт 80 / Кт 86) ───
  Ledger2::apply(_marketplace, coopname,
                 operations::marketplace::LOCK_ORDER,
                 total_cost, orderer, order_hash,
                 Marketplace::Memo::get_stock_order_block_memo(new_id));
}
