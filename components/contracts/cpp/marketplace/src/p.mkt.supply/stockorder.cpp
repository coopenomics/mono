/**
 * @brief Заказ из обезличенного остатка склада кооператива (паевая модель,
 * компонент 68). Продавец — сам кооператив (`offerer == coopname`), имущество
 * уже на счёте 10 после ранее закрытых приёмок, поэтому заказ создаётся сразу
 * в `acceptcoop` и идёт только через выдачу (readyissue → issuestmt → … →
 * issueact2). Этапы поставки и выплата поставщику для него не существуют.
 *
 * Фондируется как обычный заказ, но паевой источник — свободный паевой
 * «Стола заказов» (средства, вернувшиеся за отмены, недовыдачи и гарантийные
 * возвраты): внутренний членский кошелёк первым — взнос (o.mkt.fee) и тело
 * (o.mkt.lockm → членский резерв), остаток тела — o.mkt.lockp (w.mkt.share →
 * w.mkt.order, без проводки). Недостающую часть пайщик заранее перевёл
 * действием `convert` (o.mkt.convp) по заявлению 1110. Автоматического
 * добора с паевого Цифрового кошелька нет: при нехватке — отказ с суммами.
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

  // ── План фондирования: членский кошелёк первым (взнос, затем тело), остаток
  //    тела — со свободного паевого «Стола заказов» ──────────────────────
  const Marketplace::OrderFunding funding =
      Marketplace::plan_order_funding(coopname, orderer, total_cost, membership_fee);
  auto bal_share = Marketplace::get_user_wallet_balance(
      coopname, ledger2_wallets::MARKETPLACE_SHARE_FUND, orderer);
  eosio::check(bal_share.available >= funding.body_share,
               std::string{"Недостаточно свободного паевого «Стола заказов» для заказа из остатка: требуется "} +
                 funding.body_share.to_string() +
                 ", доступно " + bal_share.available.to_string() +
                 ". Пополните паевой взнос и разместите обычный заказ либо дождитесь остатка от отмен и недовыдач.");

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
    o.actual_quantity = quantity;          // до issuestmt == quantity
    o.package_size    = package_size;      // Эпик 18: 0 = по мере, >0 = упаковкой
    o.unit_price      = unit_price;
    o.total_cost      = total_cost;
    o.fact_cost       = total_cost;        // до issuestmt == total_cost

    o.warranty_period_secs = warranty_period_secs;

    o.status      = OrderStatus::ACCEPTED_TO_COOP; // имущество уже в кооперативе
    o.batch_hash  = batch_hash;

    // Уценки ещё нет; взнос — по ставке на момент заказа.
    o.markdown_cost  = eosio::asset(0, _root_govern_symbol);
    o.membership_fee = membership_fee;
    o.member_funded  = funding.body_member;
  });

  // ── o.mkt.fee (взнос с членского кошелька), o.mkt.lockm (членский резерв),
  //    o.mkt.lockp (паевой резерв w.mkt.share → w.mkt.order, без проводки) ──
  Marketplace::apply_order_funding(coopname, new_id, orderer, order_hash, funding,
                                   operations::marketplace::LOCK_FROM_SHARE,
                                   Marketplace::Memo::get_stock_order_block_memo(new_id));
}
