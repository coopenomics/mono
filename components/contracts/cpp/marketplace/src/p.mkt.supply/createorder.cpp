/**
 * @brief Заказчик размещает заказ на товар (Story 4.1, p.mkt.supply шаг 1).
 *
 * Серия операций (атомарно в одной транзакции Antelope):
 *  1. `o.wal.conv` (conditional) — TRANSFER w.wal.share → w.wal.member,
 *     Дт 80 / Кт 86. Только если на `w.wal.member.available` заказчика
 *     не хватает суммы заказа.
 *  2. `o.mkt.lock` (всегда) — TRANSFER w.wal.member → w.mkt.order пайщика на
 *     total_cost (резерв средств под этот Order; без проводки — оба кошелька на 86).
 *
 * Guards (из p.mkt.supply.standard.yaml + Locked Decision L6):
 *  - quantity > 0; unit_price > 0 в _root_govern_symbol; cycle_type валидный.
 *  - Order с таким hash ещё не создан (idempotency).
 *  - Заказчик — активный пайщик кооператива (`get_participant_or_fail`).
 *  - `delivery_braname` существует в `branches` (КУ выдачи задаётся пайщиком
 *    из доступных и неизменен после создания Order'а).
 *  - Σ available двух кошельков (w.wal.share + w.wal.member) >= total_cost;
 *    иначе createorder фейлится без создания Order'а.
 *  - Подписка пайщика на оферту ЦПП «Стол заказов» (L2/L3 онбординг) —
 *    автоматически проверяется в `ledger2::walletop` через
 *    `assert_program_signed` (cross-contract в `wallet::users.programs[]`)
 *    при первом TRANSFER на USER_SHARED-кошельке программы (w.mkt.order).
 *
 * Сообщения проверок — для прямого показа пользователю (UI ловит check'ом).
 *
 * @note process_hash для обеих ledger2-операций — `order_hash`. Это
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
                               eosio::name delivery_braname,
                               uint64_t quantity,
                               eosio::asset unit_price,
                               eosio::name cycle_type,
                               uint32_t warranty_period_secs,
                               checksum256 batch_hash) {
  require_auth(coopname);

  // ── Базовая валидация параметров ────────────────────────────────────
  eosio::check(quantity > 0, "Количество должно быть больше нуля");
  eosio::check(unit_price.is_valid() && unit_price.amount > 0,
               "Некорректная цена за единицу");
  eosio::check(unit_price.symbol == _root_govern_symbol,
               "Некорректный символ валюты в цене");
  eosio::check(cycle_type == CycleType::TIME_BASED ||
               cycle_type == CycleType::VOLUME_BASED ||
               cycle_type == CycleType::OPEN_SUBSCRIPT ||
               cycle_type == CycleType::INDIVIDUAL,
               "Неизвестный тип цикла отсечки заявок");

  // Idempotency: Order с таким hash не должен существовать
  eosio::check(!Marketplace::get_order_by_hash(coopname, order_hash).has_value(),
               "Заказ с таким идентификатором уже создан");

  // Заказчик — активный пайщик кооператива (бросает если не найден / blocked)
  get_participant_or_fail(coopname, orderer);

  // КУ выдачи существует
  get_branch_or_fail(coopname, delivery_braname);

  // ── Расчёт total_cost ────────────────────────────────────────────────
  eosio::asset total_cost = eosio::asset(
      static_cast<int64_t>(quantity) * unit_price.amount,
      _root_govern_symbol);
  eosio::check(total_cost.amount > 0,
               "Итоговая сумма заказа должна быть больше нуля");

  // ── Достаточность средств: Σ available двух кошельков >= total_cost ─
  auto bal_share  = Marketplace::get_user_wallet_balance(
      coopname, ledger2_wallets::SHARE_FUND_PAY, orderer);
  auto bal_member = Marketplace::get_user_wallet_balance(
      coopname, ledger2_wallets::CK_MEMBER, orderer);

  eosio::asset total_available = bal_share.available + bal_member.available;
  eosio::check(total_available >= total_cost,
               std::string{"Недостаточно средств для заказа: требуется "} +
                 total_cost.to_string() + ", доступно " + total_available.to_string());

  // ── Расчёт conditional-доли конвертации ─────────────────────────────
  // Сначала тратим w.wal.member.available; недостающее берём из w.wal.share
  // через o.wal.conv (паевой → членский).
  const eosio::asset zero = eosio::asset(0, _root_govern_symbol);

  eosio::asset need_to_conv = (bal_member.available >= total_cost)
                                ? zero
                                : (total_cost - bal_member.available);

  // ── Создание Order entity (id потребуется для memo) ─────────────────
  orders_index orders(_marketplace, coopname.value);
  uint64_t new_id = orders.available_primary_key();

  orders.emplace(_marketplace, [&](auto& o) {
    o.id              = new_id;
    o.hash            = order_hash;
    o.coopname        = coopname;
    o.orderer         = orderer;
    o.offerer         = offerer;
    o.offer_hash      = offer_hash;

    o.delivery_braname = delivery_braname;
    o.accept_braname   = eosio::name{};   // заполняется на signsupp

    o.quantity        = quantity;
    o.actual_quantity = quantity;          // до signiss2 == quantity (Story 6.2/6.3)
    o.unit_price      = unit_price;
    o.total_cost      = total_cost;
    o.fact_cost       = total_cost;        // до signiss2 == total_cost

    o.cycle_type            = cycle_type;
    o.warranty_period_secs  = warranty_period_secs;

    o.status      = OrderStatus::ACTIVE;
    o.batch_hash  = batch_hash;
  });

  // ── Шаг 1: o.wal.conv (conditional, w.wal.share → w.wal.member) ──────
  if (need_to_conv.amount > 0) {
    Ledger2::apply(_marketplace, coopname,
                   operations::wallet::CONVERT_TO_MEMBER,
                   need_to_conv, orderer, order_hash,
                   Marketplace::Memo::get_create_order_convert_memo(new_id));
  }

  // ── Шаг 2: o.mkt.lock (всегда, TRANSFER w.wal.member → w.mkt.order) ──
  // Резервируем total_cost на отдельный кошелёк w.mkt.order под этот Order.
  Ledger2::apply(_marketplace, coopname,
                 operations::marketplace::LOCK_ORDER,
                 total_cost, orderer, order_hash,
                 Marketplace::Memo::get_create_order_block_memo(new_id));
}
