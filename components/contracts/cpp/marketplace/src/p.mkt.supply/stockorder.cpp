/**
 * @brief Заказ из обезличенного остатка склада кооператива (паевая модель,
 * компонент 68). Продавец — сам кооператив (`offerer == coopname`), имущество
 * уже на счёте 10 после ранее закрытых приёмок, поэтому заказ создаётся сразу
 * в `acceptcoop` и идёт только через выдачу (readyissue → issuestmt → … →
 * issueact2). Этапы поставки и выплата поставщику для него не существуют.
 *
 * Фондируется из свободного паевого «Стола заказов» пайщика — средств,
 * вернувшихся ему за отмены, недовыдачи и гарантийные возвраты:
 *  - o.mkt.lockp — тело заказа (w.mkt.share → w.mkt.order, без проводки);
 *  - o.mkt.convp — конвертация недостающей до взноса части по Заявлению о
 *    конвертации 1110 (w.mkt.share → w.mkt.member, Дт 80 / Кт 86); остаток
 *    членского кошелька программы идёт в зачёт автоматически;
 *  - o.mkt.fee — членский взнос участка (w.mkt.member → w.mkt.fee, без проводки).
 * Автоматического добора с паевого Цифрового кошелька нет: при нехватке —
 * отказ с суммами, пайщик пополняет паевой и размещает обычный заказ.
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
                              checksum256 batch_hash,
                              document2 convert_statement) {
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

  // ── Недостающая до взноса часть членского кошелька программы —
  //    конвертируется из свободного паевого только по заявлению 1110 ──────
  const eosio::asset convert_amount =
      Marketplace::membership_fee_shortfall(coopname, orderer, membership_fee);
  if (convert_amount.amount > 0) {
    eosio::check(!is_empty_document(convert_statement),
                 "Отсутствует заявление о переводе паевого взноса с уплатой членского взноса на сумму конвертации " +
                   convert_amount.to_string());
  }
  if (!is_empty_document(convert_statement)) {
    verify_document_or_fail(convert_statement, { orderer });
  }

  // ── Достаточность свободного паевого: w.mkt.share.available >= тело + конвертация ──
  const eosio::asset required_total = total_cost + convert_amount;
  auto bal_share = Marketplace::get_user_wallet_balance(
      coopname, ledger2_wallets::MARKETPLACE_SHARE_FUND, orderer);
  eosio::check(bal_share.available >= required_total,
               std::string{"Недостаточно свободного паевого «Стола заказов» для заказа из остатка: требуется "} +
                 required_total.to_string() +
                 (convert_amount.amount > 0
                      ? " (включая конвертацию в членский взнос " + convert_amount.to_string() + ")"
                      : "") +
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
  });

  // ── o.mkt.lockp: тело — TRANSFER w.mkt.share → w.mkt.order (без Dr/Cr) ──
  Ledger2::apply(_marketplace, coopname,
                 operations::marketplace::LOCK_FROM_SHARE,
                 processes::marketplace::SUPPLY,
                 total_cost, orderer, order_hash,
                 Marketplace::Memo::get_stock_order_block_memo(new_id));

  // ── o.mkt.convp: конвертация недостающей части взноса по заявлению 1110 —
  //    TRANSFER w.mkt.share → w.mkt.member (Дт 80 / Кт 86) ─────────────────
  if (convert_amount.amount > 0) {
    Ledger2::apply(_marketplace, coopname,
                   operations::marketplace::CONVERT_FROM_SHARE,
                   processes::marketplace::SUPPLY,
                   convert_amount, orderer, order_hash,
                   Marketplace::Memo::get_convert_to_member_memo(new_id));
  }
  // Подписанное заявление публикуется всегда, даже если взнос покрыт остатком
  // членского кошелька: оно описывает перевод всей суммы заказа в программу.
  if (!is_empty_document(convert_statement)) {
    Soviet::make_complete_document(_marketplace, coopname, orderer,
                                   "stockorder"_n,
                                   convert_statement.hash, convert_statement);
  }

  // ── o.mkt.fee: членский взнос под заказ — TRANSFER w.mkt.member → w.mkt.fee
  //    (без проводки, оба на 86); ставка зафиксирована в Order.membership_fee ──
  Marketplace::lock_membership_fee(coopname, new_id, orderer, order_hash, membership_fee,
                                   Marketplace::Memo::get_membership_fee_lock_memo(new_id));
}
