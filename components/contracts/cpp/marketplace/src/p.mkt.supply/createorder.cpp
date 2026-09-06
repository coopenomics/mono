/**
 * @brief Заказчик размещает заказ на товар (Story 4.1, p.mkt.supply шаг 1).
 *
 * Движения (паевая модель, компонент 68):
 *  - `o.mkt.lock` (TRANSFER w.wal.share → w.mkt.order на total_cost, без
 *    проводки — оба кошелька на 80) — паевой резерв под этот Order; тело
 *    заказа остаётся паевым взносом;
 *  - `o.mkt.conv` (TRANSFER w.wal.share → w.mkt.member, Дт 80 / Кт 86) — по
 *    Заявлению 1110 на недостающую до взноса участка сумму; остаток членского
 *    кошелька программы идёт в зачёт автоматически. Само заявление — на
 *    полную сумму перевода в программу с выделением взноса — подписывается
 *    при каждом заказе и публикуется в реестр документов;
 *  - `o.mkt.fee` (TRANSFER w.mkt.member → w.mkt.fee, без проводки) — членский
 *    взнос участка под заказ по единой ставке кооператива.
 *
 * Guards (из p.mkt.supply.standard.yaml + Locked Decision L6):
 *  - quantity > 0; unit_price > 0 в _root_govern_symbol.
 *  - Order с таким hash ещё не создан (idempotency).
 *  - Заказчик — активный пайщик кооператива (`get_participant_or_fail`).
 *  - `delivery_braname` существует в `branches` (КУ выдачи задаётся пайщиком
 *    из доступных и неизменен после создания Order'а).
 *  - w.mkt.member.available заказчика >= взнос; w.wal.share.available >= паевая
 *    часть тела; иначе createorder фейлится без создания Order'а.
 *  - Подписка пайщика на оферту ЦПП «Стол заказов» (L2/L3 онбординг) —
 *    автоматически проверяется в `ledger2::walletop` через
 *    `assert_program_signed` (cross-contract в `wallet::users.programs[]`)
 *    при первом TRANSFER на USER_SHARED-кошельке программы (w.mkt.order).
 *
 * Сообщения проверок — для прямого показа пользователю (UI ловит check'ом).
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::createorder(eosio::name coopname,
                               eosio::name orderer,
                               checksum256 order_hash,
                               checksum256 offer_hash,
                               eosio::name offerer,
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

  // КУ выдачи существует
  get_branch_or_fail(coopname, delivery_braname);

  // ── Расчёт total_cost (Эпик 17/18: по мере — qty*price/10^prec; упаковкой — packages*price) ──
  const eosio::asset total_cost = Marketplace::calc_cost(quantity, unit_price, package_size);
  eosio::check(total_cost.amount > 0,
               "Итоговая сумма заказа должна быть больше нуля");

  // ── Членский взнос по единой ставке кооператива (requirement b6) ─────
  const eosio::asset membership_fee = Marketplace::calc_membership_fee(
      total_cost, Marketplace::get_membership_fee_percent(coopname));

  // ── План фондирования: членский кошелёк первым (взнос, затем тело), остаток
  //    тела — паевой с главного паевого кошелька ─────────────────────────
  const Marketplace::OrderFunding funding =
      Marketplace::plan_order_funding(coopname, orderer, total_cost, membership_fee);
  auto bal_share = Marketplace::get_user_wallet_balance(
      coopname, ledger2_wallets::SHARE_FUND_PAY, orderer);
  eosio::check(bal_share.available >= funding.body_share,
               std::string{"Недостаточно паевых средств для заказа: требуется "} +
                 funding.body_share.to_string() +
                 ", доступно " + bal_share.available.to_string());

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
    o.actual_quantity = quantity;          // до issuestmt == quantity
    o.package_size    = package_size;      // Эпик 18: 0 = по мере, >0 = упаковкой
    o.unit_price      = unit_price;
    o.total_cost      = total_cost;
    o.fact_cost       = total_cost;        // до issuestmt == total_cost

    o.warranty_period_secs  = warranty_period_secs;

    o.status      = OrderStatus::ACTIVE;
    o.batch_hash  = batch_hash;

    // Уценки ещё нет; взнос — по ставке на момент заказа.
    o.markdown_cost  = eosio::asset(0, _root_govern_symbol);
    o.membership_fee = membership_fee;
    o.member_funded  = funding.body_member;
  });

  // ── o.mkt.fee (взнос с членского кошелька), o.mkt.lockm (членский резерв),
  //    o.mkt.lock (паевой резерв w.wal.share → w.mkt.order, без проводки) ──
  Marketplace::apply_order_funding(coopname, new_id, orderer, order_hash, funding,
                                   operations::marketplace::LOCK_ORDER,
                                   Marketplace::Memo::get_create_order_block_memo(new_id));
}
