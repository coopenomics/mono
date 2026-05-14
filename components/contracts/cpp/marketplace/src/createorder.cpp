/**
 * @brief Заказчик размещает заказ на товар (Story 4.1, p.mkt.supply шаг 1).
 *
 * Серия операций (атомарно в одной транзакции Antelope):
 *  1. `o.wal.conv` (conditional) — TRANSFER w.wal.share → w.wal.member,
 *     Дт 80 / Кт 86. Только если на `w.wal.member.available` заказчика и
 *     на `w.mkt.member.available` суммарно не хватает суммы заказа.
 *  2. `o.mkt.assign` (conditional) — TRANSFER w.wal.member → w.mkt.member,
 *     без проводки. Только если на `w.mkt.member.available` не хватает.
 *  3. `o.mkt.block` (всегда) — BLOCK на `w.mkt.member` пайщика на total_cost.
 *
 * Guards (из p.mkt.supply.standard.yaml + Locked Decision L6):
 *  - quantity > 0; unit_price > 0 в _root_govern_symbol; cycle_type валидный.
 *  - Order с таким hash ещё не создан (idempotency).
 *  - Заказчик — активный пайщик кооператива (`get_participant_or_fail`).
 *  - **L6:** Σ available трёх кошельков (w.wal.share + w.wal.member + w.mkt.member)
 *    >= total_cost; иначе createorder фейлится без создания Order'а.
 *  - Подписка пайщика на оферту ЦПП «Стол заказов» (L2/L3 онбординг) —
 *    автоматически проверяется в `ledger2::walletop` через
 *    `assert_program_signed` (cross-contract в `wallet::users.programs[]`)
 *    при первом ASSIGN/BLOCK на USER_SHARED-кошельке программы.
 *
 * @note process_hash для всех трёх ledger2-операций — `order_hash`. Это
 *       даёт backend'у одну точку группировки операций процесса
 *       p.mkt.supply через `getProcess(process_hash)` (Story 9.3).
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::createorder(eosio::name coopname,
                               eosio::name orderer,
                               checksum256 order_hash,
                               checksum256 offer_hash,
                               eosio::name offerer,
                               eosio::name ku_chairman,
                               uint64_t quantity,
                               eosio::asset unit_price,
                               eosio::name cycle_type,
                               uint32_t warranty_period_secs) {
  require_auth(coopname);

  // ── Базовая валидация параметров ────────────────────────────────────
  eosio::check(quantity > 0, "createorder: quantity должно быть > 0");
  eosio::check(unit_price.is_valid() && unit_price.amount > 0,
               "createorder: некорректная unit_price");
  eosio::check(unit_price.symbol == _root_govern_symbol,
               "createorder: некорректный символ валюты unit_price");
  eosio::check(cycle_type == CycleType::TIME_BASED ||
               cycle_type == CycleType::VOLUME_BASED ||
               cycle_type == CycleType::OPEN_SUBSCRIPT ||
               cycle_type == CycleType::INDIVIDUAL,
               "createorder: неизвестный cycle_type (допустимые: timebased, volumebased, opensubscr, individual)");

  // Idempotency: Order с таким hash не должен существовать
  eosio::check(!Marketplace::get_order_by_hash(coopname, order_hash).has_value(),
               "createorder: Order с таким hash уже существует");

  // Заказчик — активный пайщик кооператива (бросает если не найден / blocked)
  get_participant_or_fail(coopname, orderer);

  // ── Расчёт total_cost ────────────────────────────────────────────────
  eosio::asset total_cost = eosio::asset(
      static_cast<int64_t>(quantity) * unit_price.amount,
      _root_govern_symbol);
  eosio::check(total_cost.amount > 0,
               "createorder: total_cost overflow или ноль");

  // ── L6 guard: Σ available трёх кошельков >= total_cost ───────────────
  // Чтение балансов через cross-contract scope ledger2.
  auto bal_share  = Marketplace::get_user_wallet_balance(
      coopname, ledger2_wallets::SHARE_FUND_PAY, orderer);
  auto bal_member = Marketplace::get_user_wallet_balance(
      coopname, ledger2_wallets::CK_MEMBER, orderer);
  auto bal_mkt    = Marketplace::get_user_wallet_balance(
      coopname, ledger2_wallets::MARKETPLACE_MEMBER, orderer);

  eosio::asset total_available =
      bal_share.available + bal_member.available + bal_mkt.available;
  eosio::check(total_available >= total_cost,
               std::string{"createorder: недостаточно средств — нужно "} +
                 total_cost.to_string() + ", доступно " + total_available.to_string() +
                 " (Locked Decision L6)");

  // ── Расчёт conditional-долей серии ──────────────────────────────────
  // Сначала тратим w.mkt.member.available; недостающее берём из w.wal.member
  // через assign; недостающее в w.wal.member берём из w.wal.share через conv.
  const eosio::asset zero = eosio::asset(0, _root_govern_symbol);

  eosio::asset need_to_assign = (bal_mkt.available >= total_cost)
                                 ? zero
                                 : (total_cost - bal_mkt.available);
  eosio::asset need_to_conv   = (bal_member.available >= need_to_assign)
                                 ? zero
                                 : (need_to_assign - bal_member.available);

  const std::string memo = "createorder p.mkt.supply";

  // ── Шаг 1: o.wal.conv (conditional) ──────────────────────────────────
  if (need_to_conv.amount > 0) {
    Ledger2::apply(_marketplace, coopname,
                   operations::wallet::CONVERT_TO_MEMBER,
                   need_to_conv, orderer, order_hash, memo);
  }

  // ── Шаг 2: o.mkt.assign (conditional) ────────────────────────────────
  if (need_to_assign.amount > 0) {
    Ledger2::apply(_marketplace, coopname,
                   operations::marketplace::ASSIGN_TO_PROGRAM,
                   need_to_assign, orderer, order_hash, memo);
  }

  // ── Шаг 3: o.mkt.block (всегда) ──────────────────────────────────────
  Ledger2::apply(_marketplace, coopname,
                 operations::marketplace::BLOCK_FOR_ORDER,
                 total_cost, orderer, order_hash, memo);

  // ── Создание Order entity ────────────────────────────────────────────
  orders_index orders(_marketplace, coopname.value);
  const auto now = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());

  orders.emplace(_marketplace, [&](auto& o) {
    o.id              = orders.available_primary_key();
    o.hash            = order_hash;
    o.coopname        = coopname;
    o.orderer         = orderer;
    o.ku_chairman     = ku_chairman;
    o.offer_hash      = offer_hash;
    o.offerer         = offerer;

    o.quantity        = quantity;
    o.actual_quantity = quantity;          // до signiss2 == quantity (Story 6.2/6.3)
    o.unit_price      = unit_price;
    o.total_cost      = total_cost;
    o.fact_cost       = total_cost;        // до signiss2 == total_cost

    o.cycle_type            = cycle_type;
    o.warranty_period_secs  = warranty_period_secs;

    o.status     = OrderStatus::ACTIVE;
    o.created_at = now;
  });
}
