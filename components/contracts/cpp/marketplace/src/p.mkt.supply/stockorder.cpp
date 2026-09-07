/**
 * @brief Заказ из обезличенного остатка склада кооператива (паевая модель,
 * компонент 68). Продавец — сам кооператив (`offerer == coopname`), имущество
 * уже на счёте 10 после ранее закрытых приёмок, поэтому заказ создаётся сразу
 * в `acceptcoop` и идёт только через выдачу (readyissue → issuestmt → … →
 * issueact2). Этапы поставки и выплата поставщику для него не существуют.
 *
 * Фондируется как обычный заказ: взнос участка — с внутреннего членского
 * кошелька (o.mkt.fee), тело — сначала со свободного паевого «Стола заказов»
 * (o.mkt.lockp), остаток с главного паевого Цифрового кошелька (o.mkt.lock).
 * Недостающее пайщик заранее перевёл действием `convert` по заявлению 1110.
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

  // ── Членского кошелька обязано хватать на взнос; тело — паевыми кошельками ──
  Marketplace::require_member_fee(coopname, orderer, membership_fee);
  {
    auto program = Marketplace::get_user_wallet_balance(coopname, ledger2_wallets::MARKETPLACE_SHARE_FUND, orderer);
    auto wallet  = Marketplace::get_user_wallet_balance(coopname, ledger2_wallets::SHARE_FUND_PAY, orderer);
    eosio::check(program.available + wallet.available >= total_cost,
                 std::string{"Недостаточно паевых средств для заказа из остатка: требуется "} + total_cost.to_string() +
                   ", доступно " + (program.available + wallet.available).to_string() +
                   " (свободный паевой Стола заказов " + program.available.to_string() +
                   " и Цифровой кошелёк " + wallet.available.to_string() + ")");
  }

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
  });
  // ── o.mkt.fee: взнос с внутреннего членского кошелька (внутри 86) ──
  Marketplace::lock_membership_fee(coopname, new_id, orderer, order_hash, membership_fee,
                                   Marketplace::Memo::get_membership_fee_lock_memo(new_id));
  // ── тело: o.mkt.lockp со свободного паевого программы, остаток o.mkt.lock с ЦК ──
  Marketplace::lock_order_body(coopname, new_id, orderer, order_hash, total_cost,
                               Marketplace::Memo::get_stock_order_block_memo(new_id),
                               Marketplace::Memo::get_create_order_block_memo(new_id));
}
