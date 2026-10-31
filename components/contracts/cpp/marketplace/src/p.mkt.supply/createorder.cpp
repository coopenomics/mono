/**
 * @brief Заказчик размещает заказ на товар (Story 4.1, p.mkt.supply шаг 1).
 *
 * Движения (паевая модель, компонент 68; обеспечительная часть — задача
 * 99D-18, решение владельца 31.10.2026). Всё, что вносит пайщик, остаётся
 * паевым взносом на счёте 80; недостающее на свободном паевом «Стола заказов»
 * транслируется с Цифрового кошелька по заявлению 1110 (действие `convert`
 * первым в той же транзакции оформления):
 *  - `o.mkt.fee` — обеспечительная часть паевого взноса по единой ставке со
 *    свободного паевого w.mkt.share в пул w.mkt.fee (её обязано хватать целиком);
 *  - `o.mkt.lockp` — тело заказа с остатка свободного паевого w.mkt.share;
 *  - `o.mkt.lock` — остаток тела с главного паевого w.wal.share.
 *  Тело — один резерв w.mkt.order (без проводок).
 *
 * Guards (из p.mkt.supply.standard.yaml + Locked Decision L6):
 *  - quantity > 0; unit_price > 0 в _root_govern_symbol.
 *  - Order с таким hash ещё не создан (idempotency).
 *  - Заказчик — активный пайщик кооператива (`get_participant_or_fail`).
 *  - `delivery_braname` существует в `branches` (КУ выдачи задаётся пайщиком
 *    из доступных и неизменен после создания Order'а).
 *  - w.mkt.share >= обеспечительная часть; w.mkt.share + w.wal.share >= тело
 *    плюс обеспечительная часть; иначе createorder фейлится без создания Order'а.
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

  // Сам кооператив пользуется столом только через заказ из остатка
  // (stockorder): поставщиком по обычному заказу он быть не может — приёмка
  // открыла бы долг на 76 без права выплаты (задача 99D-16).
  eosio::check(offerer != coopname,
               "Кооператив не может быть поставщиком заказа — используйте заказ из остатка");

  // Заказчик — действующий пайщик без начатого выхода
  get_active_participant_or_fail(coopname, orderer);

  // КУ выдачи существует
  get_branch_or_fail(coopname, delivery_braname);

  // ── Расчёт total_cost (Эпик 17/18: по мере — qty*price/10^prec; упаковкой — packages*price) ──
  const eosio::asset total_cost = Marketplace::calc_cost(quantity, unit_price, package_size);
  eosio::check(total_cost.amount > 0,
               "Итоговая сумма заказа должна быть больше нуля");

  // ── Обеспечительная часть паевого взноса по единой ставке кооператива ──
  const eosio::asset membership_fee = Marketplace::calc_membership_fee(
      total_cost, Marketplace::get_membership_fee_percent(coopname));

  // ── Обеспечительная часть — со свободного паевого программы; тело — с его
  //    остатка и Цифрового кошелька (задача 99D-18) ──
  Marketplace::require_order_funding(coopname, orderer, total_cost, membership_fee);

  // ── Создание Order entity (id потребуется для memo) ─────────────────
  orders_index orders(_marketplace, coopname.value);
  uint64_t new_id = orders.available_primary_key();

  orders.emplace(RamPayer::of(orders, coopname), [&](auto& o) {
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

    // Уценки ещё нет; обеспечительная часть — по ставке на момент заказа.
    o.markdown_cost  = eosio::asset(0, _root_govern_symbol);
    o.membership_fee = membership_fee;
  });

  // ── o.mkt.fee: обеспечительная часть со свободного паевого (внутри 80) ──
  Marketplace::lock_secure_part(coopname, orderer, order_hash, membership_fee,
                                Marketplace::Memo::get_secure_part_lock_memo(new_id));
  // ── тело: o.mkt.lockp со свободного паевого программы, остаток o.mkt.lock с ЦК ──
  Marketplace::lock_order_body(coopname, new_id, orderer, order_hash, total_cost,
                               Marketplace::Memo::get_stock_order_block_memo(new_id),
                               Marketplace::Memo::get_create_order_block_memo(new_id));
}
