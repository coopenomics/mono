/**
 * @brief Заказчик размещает заказ на товар (Story 4.1, p.mkt.supply шаг 1).
 *
 * Одна ledger2-операция:
 *  - `o.mkt.lock` (TRANSFER w.wal.share → w.mkt.order пайщика на total_cost,
 *    Дт 80 / Кт 86) — резерв средств заказчика под этот Order. Паевой пайщика
 *    переходит в целевое финансирование на резерв-кошелёк.
 *
 * Guards (из p.mkt.supply.standard.yaml + Locked Decision L6):
 *  - quantity > 0; unit_price > 0 в _root_govern_symbol.
 *  - Order с таким hash ещё не создан (idempotency).
 *  - Заказчик — активный пайщик кооператива (`get_participant_or_fail`).
 *  - `delivery_braname` существует в `branches` (КУ выдачи задаётся пайщиком
 *    из доступных и неизменен после создания Order'а).
 *  - w.wal.share.available заказчика >= total_cost; иначе createorder фейлится
 *    без создания Order'а.
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
                               checksum256 batch_hash,
                               document2 convert_statement) {
  require_auth(coopname);

  // ── Базовая валидация параметров ────────────────────────────────────
  Marketplace::check_quantity(quantity);
  Marketplace::check_packaging(quantity, package_size);  // Эпик 18: при упаковочном отпуске quantity кратно упаковке
  eosio::check(!is_empty_document(convert_statement),
               "Отсутствует заявление о конвертации паевого взноса");
  verify_document_or_fail(convert_statement, { orderer });
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

  // ── Достаточность средств: w.wal.share.available >= стоимость + взнос ──
  const eosio::asset required_total = total_cost + membership_fee;
  auto bal_share = Marketplace::get_user_wallet_balance(
      coopname, ledger2_wallets::SHARE_FUND_PAY, orderer);
  eosio::check(bal_share.available >= required_total,
               std::string{"Недостаточно средств для заказа: требуется "} +
                 required_total.to_string() +
                 (membership_fee.amount > 0
                      ? " (включая членский взнос " + membership_fee.to_string() + ")"
                      : "") +
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
    o.actual_quantity = quantity;          // до signiss2 == quantity (Story 6.2/6.3)
    o.package_size    = package_size;      // Эпик 18: 0 = по мере, >0 = упаковкой
    o.unit_price      = unit_price;
    o.total_cost      = total_cost;
    o.fact_cost       = total_cost;        // до signiss2 == total_cost

    o.warranty_period_secs  = warranty_period_secs;

    o.status      = OrderStatus::ACTIVE;
    o.batch_hash  = batch_hash;

    // Уценки ещё нет; взнос — по ставке на момент заказа.
    o.markdown_cost  = eosio::asset(0, _root_govern_symbol);
    o.membership_fee = membership_fee;
  });

  // ── o.mkt.lock: TRANSFER w.wal.share → w.mkt.order (Дт 80 / Кт 86) ───
  Ledger2::apply(_marketplace, coopname,
                 operations::marketplace::LOCK_ORDER,
                 total_cost, orderer, order_hash,
                 Marketplace::Memo::get_create_order_block_memo(new_id));

  // ── o.mkt.fee: членский взнос — TRANSFER w.wal.share → w.mkt.fee
  //    (Дт 80 / Кт 86); ставка зафиксирована в Order.membership_fee ─────
  if (membership_fee.amount > 0) {
    Ledger2::apply(_marketplace, coopname,
                   operations::marketplace::MEMBERSHIP_FEE_LOCK,
                   membership_fee, orderer, order_hash,
                   Marketplace::Memo::get_membership_fee_lock_memo(new_id));
  }

  // Заявление о конвертации публикуется в реестр документов отдельным
  // самостоятельным пакетом (package = hash самого заявления): конвертация —
  // операция программы «Стол заказов», а не процесса поставки (пакет процесса
  // поставки группируется вокруг order_hash актами приёма-передачи).
  Soviet::make_complete_document(_marketplace, coopname, orderer,
                                 "createorder"_n,
                                 convert_statement.hash, convert_statement);
}
