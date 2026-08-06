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
 * Фондируется ВСЕГДА из членского кошелька «Стола заказов» пайщика начисто
 * (без паевого), две ledger2-операции (оба кошелька на 86, без проводок):
 *  - `o.mkt.lockm`  (TRANSFER w.mkt.member → w.mkt.order  на total_cost) — тело;
 *  - `o.mkt.lockmf` (TRANSFER w.mkt.member → w.mkt.fee    на взнос)      — взнос.
 * Паевой взнос пополняет членский кошелёк ЗАРАНЕЕ отдельным действием `convert`
 * (Заявление о конвертации). При замене непоставленного на свободный остаток
 * высвобожденные отменой средства уже лежат в w.mkt.member — заказ создаётся
 * без конвертации и без доплаты с паевого.
 *
 * Guards (зеркало createorder + специфика остатка):
 *  - quantity > 0; unit_price > 0 в _root_govern_symbol (цена публикации
 *    остатка: цена прибытия либо уценка — requirement 76, решение 12).
 *  - Order с таким hash ещё не создан (idempotency).
 *  - Заказчик — активный пайщик кооператива.
 *  - `delivery_braname` существует: КУ, на складе которого лежит остаток;
 *    он же — КУ выдачи (`accept_braname` и `current_warehouse_braname`
 *    равны ему: имущество уже на месте, логистики нет).
 *  - w.mkt.member.available заказчика >= total_cost + взнос (членских средств
 *    должно хватать; недостающее конвертируется заранее через `convert`).
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::stockorder(eosio::name coopname,
                              eosio::name orderer,
                              checksum256 order_hash,
                              checksum256 offer_hash,
                              eosio::name delivery_braname,
                              eosio::asset quantity,
                              eosio::asset unit_price,
                              eosio::asset package_size,
                              uint32_t warranty_period_secs,
                              checksum256 batch_hash) {
  require_auth(coopname);

  // ── Базовая валидация параметров ────────────────────────────────────
  Marketplace::check_quantity(quantity);
  Marketplace::check_packaging(quantity, package_size);  // Эпик 18: при упаковочном отпуске quantity кратно упаковке
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

  // ── Расчёт total_cost (Эпик 17/18: по мере — qty*price/10^prec; упаковкой — packages*price) ──
  const eosio::asset total_cost = Marketplace::calc_cost(quantity, unit_price, package_size);
  eosio::check(total_cost.amount > 0,
               "Итоговая сумма заказа должна быть больше нуля");

  // ── Членский взнос по единой ставке кооператива (requirement b6) ─────
  const eosio::asset membership_fee = Marketplace::calc_membership_fee(
      total_cost, Marketplace::get_membership_fee_percent(coopname));

  // ── Достаточность ЧЛЕНСКИХ средств: w.mkt.member.available >= тело + взнос ──
  //    Заказ из остатка фондируется только из членского кошелька; если средств
  //    не хватает, пайщик сперва пополняет его действием `convert` (с паевого).
  const eosio::asset required_total = total_cost + membership_fee;
  auto bal_member = Marketplace::get_user_wallet_balance(
      coopname, ledger2_wallets::MARKETPLACE_MEMBER_FUND, orderer);
  eosio::check(bal_member.available >= required_total,
               std::string{"Недостаточно членских средств «Стола заказов» для заказа из остатка: требуется "} +
                 required_total.to_string() +
                 (membership_fee.amount > 0
                      ? " (включая членский взнос " + membership_fee.to_string() + ")"
                      : "") +
                 ", доступно " + bal_member.available.to_string() +
                 ". Сперва переведите паевой в членский (конвертация).");

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
    o.package_size    = package_size;      // Эпик 18: 0 = по мере, >0 = упаковкой
    o.unit_price      = unit_price;
    o.total_cost      = total_cost;
    o.fact_cost       = total_cost;        // до signiss2 == total_cost

    o.warranty_period_secs = warranty_period_secs;

    o.status      = OrderStatus::ACCEPTED_TO_COOP; // имущество уже в кооперативе
    o.batch_hash  = batch_hash;

    // Уценки ещё нет; взнос — по ставке на момент заказа.
    o.markdown_cost  = eosio::asset(0, _root_govern_symbol);
    o.membership_fee = membership_fee;
  });

  // ── o.mkt.lockm: тело — TRANSFER w.mkt.member → w.mkt.order (без Dr/Cr) ──
  Ledger2::apply(_marketplace, coopname,
                 operations::marketplace::LOCK_FROM_MEMBER,
                 total_cost, orderer, order_hash,
                 Marketplace::Memo::get_stock_order_block_memo(new_id));

  // ── o.mkt.lockmf: членский взнос — TRANSFER w.mkt.member → w.mkt.fee
  //    (без Dr/Cr, оба на 86); ставка зафиксирована в Order.membership_fee ──
  if (membership_fee.amount > 0) {
    Ledger2::apply(_marketplace, coopname,
                   operations::marketplace::LOCK_FEE_FROM_MEMBER,
                   membership_fee, orderer, order_hash,
                   Marketplace::Memo::get_membership_fee_lock_memo(new_id));
  }
}
