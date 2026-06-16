/**
 * @brief Заказчик закрывающей подписью АПП-выдачи получает имущество (Story 6.3, signiss2).
 *
 * Per-Order атомарная транзакция с поддержкой actual_quantity ≠ ordered (Story 6.2):
 *
 * 1) actual == ordered:
 *      Ledger2::apply(o.mkt.consum, fact_cost) — BURN w.mkt.order, Дт 86 / Кт 10
 *      (сжигание резерва заказа и выбытие имущества со склада через целевое
 *      финансирование).
 *
 * 2) actual < ordered (выдано меньше — остаток резерва возвращается):
 *      Ledger2::apply(o.mkt.unlock, ordered_cost - fact_cost) — TRANSFER w.mkt.order →
 *          w.mkt.member на разницу (остаток резерва на членский «Стола заказов»).
 *      затем — consum на fact_cost.
 *
 * 3) actual > ordered (доплата по факту — ТОЛЬКО с членского, паевой не трогаем):
 *      diff = fact_cost - ordered_cost
 *      проверка достаточности diff на w.mkt.member (членский «Стола заказов»).
 *      o.mkt.lockm(diff) — TRANSFER w.mkt.member → w.mkt.order (без проводки) —
 *          добор резерва на этот же Order с членского программы.
 *      Затем — consum на fact_cost.
 *      Недостающее на членском пайщик переводит ЗАРАНЕЕ отдельным Заявлением о
 *      конвертации (action convert, o.mkt.conv) — авто-конвертации паевого на
 *      выдаче нет НИГДЕ; при нехватке членского транзакция фейлится.
 *
 * Status: ready_to_receive → received. actual_quantity, fact_cost,
 * issue_act_signiss2, warranty_until заполняются.
 *
 * Guards:
 *  - actor == order.orderer; Order в ready_to_receive.
 *  - Подписант со стороны кооператива (`delivery_signer`) авторизован для
 *    КУ выдачи (`o.delivery_braname`).
 *  - verify_document_or_fail(act, {delivery_signer, orderer}).
 *  - actual_quantity > 0; actual_unit_price > 0 и в валюте кооператива.
 *    fact_cost = actual_quantity × actual_unit_price (цена скорректирована
 *    оператором при открытии выдачи, заказчик факт не редактирует).
 *  - При actual > ordered и нехватке средств — транзакция фейлится с
 *    человеческим сообщением, которое UI показывает напрямую.
 *  - Idempotency: is_empty_document(issue_act_signiss2).
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::signiss2(eosio::name coopname,
                            eosio::name orderer,
                            checksum256 order_hash,
                            uint64_t actual_quantity,
                            eosio::asset actual_unit_price,
                            eosio::name delivery_signer,
                            document2 act) {
  require_auth(coopname);
  eosio::check(actual_quantity > 0, "Фактическое количество должно быть больше нуля");
  eosio::check(actual_unit_price.symbol == _root_govern_symbol,
               "Фактическая цена за единицу указана в неверной валюте");
  eosio::check(actual_unit_price.amount > 0,
               "Фактическая цена за единицу должна быть больше нуля");

  auto o = Marketplace::get_order_by_hash_or_fail(coopname, order_hash);
  eosio::check(o.orderer == orderer, "Вы не заказчик этого заказа");
  eosio::check(o.status == OrderStatus::READY_TO_RECEIVE,
               "Заказ не готов к выдаче");
  eosio::check(is_empty_document(o.issue_act_signiss2),
               "Финальная подпись акта выдачи уже зафиксирована");

  auto branch = get_branch_or_fail(coopname, o.delivery_braname);
  eosio::check(branch.is_user_authorized(delivery_signer),
               "Подписант со стороны кооператива не уполномочен подписывать акты выдачи данного кооперативного участка");

  verify_document_or_fail(act, { delivery_signer, orderer });

  // Факт считается от скорректированной оператором цены (actual_unit_price),
  // а не от цены заказа (o.unit_price): оператор мог снизить/поднять цену на
  // месте (испорчена упаковка, замена позиции и т. п.).
  const eosio::asset fact_cost = eosio::asset(
      static_cast<int64_t>(actual_quantity) * actual_unit_price.amount,
      _root_govern_symbol);
  eosio::check(fact_cost.amount > 0,
               "Итоговая фактическая сумма заказа должна быть больше нуля");

  // ── Корректирующие операции (если факт ≠ заказ) ─────────────────────
  if (fact_cost < o.total_cost) {
    // actual < ordered: остаток резерва возвращается на членский «Стола заказов»
    const eosio::asset diff = o.total_cost - fact_cost;
    Ledger2::apply(_marketplace, coopname,
                   operations::marketplace::UNLOCK_ORDER,
                   diff, orderer, o.hash,
                   Marketplace::Memo::get_signiss2_correction_less_memo(o.id));

  } else if (fact_cost > o.total_cost) {
    // actual > ordered: доплата по факту — ТОЛЬКО с членского «Стола заказов».
    // Паевой на выдаче не трогаем НИКОГДА: недостающее пайщик переводит в членский
    // ЗАРАНЕЕ отдельным Заявлением о конвертации (action convert, o.mkt.conv).
    // Здесь — проверка членского и добор резерва этого же заказа из него (o.mkt.lockm).
    const eosio::asset diff = fact_cost - o.total_cost;

    auto bal_member = Marketplace::get_user_wallet_balance(
        coopname, ledger2_wallets::MARKETPLACE_MEMBER_FUND, orderer);
    eosio::check(bal_member.available >= diff,
                 std::string{"Недостаточно членских средств «Стола заказов» для дооплаты по факту: требуется "} +
                   diff.to_string() + ", доступно " + bal_member.available.to_string() +
                   ". Сперва переведите паевой в членский (Заявление о конвертации).");

    // Добор резерва заказа с членского «Стола заказов» (без проводки, оба на 86).
    Ledger2::apply(_marketplace, coopname,
                   operations::marketplace::LOCK_FROM_MEMBER,
                   diff, orderer, o.hash,
                   Marketplace::Memo::get_signiss2_correction_more_block_memo(o.id));
  }
  // fact == ordered — без корректировок

  // ── o.mkt.consum на fact_cost (BURN w.mkt.order, Дт 86 / Кт 10) ──────
  Ledger2::apply(_marketplace, coopname,
                 operations::marketplace::CONSUME_BY_MEMBER,
                 fact_cost, orderer, o.hash,
                 Marketplace::Memo::get_consume_by_member_memo(o.id));

  // ── Финализация членского взноса (requirement b6 «Экономика КУ») ─────
  // Взнос принят окончательно вместе с фактом выдачи: пересчитывается
  // пропорционально факту (ставка зафиксирована в Order на момент заказа),
  // излишек возвращается (o.mkt.refund), недостающее при факте больше заказа
  // дособирается с паевого (o.mkt.fee), затем 100% фактической суммы взноса
  // инлайн-вызовом branch::accrue зачисляется в общий кошелёк КУ выдачи —
  // приоритет общего кошелька (раунд 5): распределение доверенным —
  // отдельная команда председателя после контроля планового резерва.
  const eosio::asset locked_fee = Marketplace::get_order_membership_fee(o);
  if (locked_fee.amount > 0) {
    const eosio::asset fact_fee = eosio::asset(
        static_cast<int64_t>(static_cast<uint128_t>(locked_fee.amount) *
                             fact_cost.amount / o.total_cost.amount),
        _root_govern_symbol);

    if (fact_fee < locked_fee) {
      // Недовыдача: неиспользованная часть взноса — на членский «Стола заказов».
      Ledger2::apply(_marketplace, coopname,
                     operations::marketplace::MEMBERSHIP_FEE_REFUND,
                     locked_fee - fact_fee, orderer, o.hash,
                     Marketplace::Memo::get_membership_fee_refund_memo(o.id));
    } else if (fact_fee > locked_fee) {
      // Факт больше заказа: довзнос дособирается ТОЖЕ с членского «Стола заказов»
      // (o.mkt.lockmf: w.mkt.member → w.mkt.fee, без проводки), не с паевого.
      // Недостающее — заранее через Заявление о конвертации; здесь проверка членского.
      const eosio::asset fee_diff = fact_fee - locked_fee;
      auto bal_member_fee = Marketplace::get_user_wallet_balance(
          coopname, ledger2_wallets::MARKETPLACE_MEMBER_FUND, orderer);
      eosio::check(bal_member_fee.available >= fee_diff,
                   std::string{"Недостаточно членских средств «Стола заказов» для довзноса по факту: требуется "} +
                     fee_diff.to_string() + ", доступно " + bal_member_fee.available.to_string() +
                     ". Сперва переведите паевой в членский (Заявление о конвертации).");
      Ledger2::apply(_marketplace, coopname,
                     operations::marketplace::LOCK_FEE_FROM_MEMBER,
                     fee_diff, orderer, o.hash,
                     Marketplace::Memo::get_membership_fee_topup_memo(o.id));
    }

    if (fact_fee.amount > 0) {
      Branch::accrue(_marketplace, coopname, o.delivery_braname,
                     fact_fee, o.hash,
                     Marketplace::Memo::get_membership_fee_distribute_memo(o.id));
    }
  }

  // ── Закрытие Order'а ────────────────────────────────────────────────
  const auto now = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());
  const auto warranty_until = (o.warranty_period_secs > 0)
      ? eosio::time_point_sec(now.sec_since_epoch() + o.warranty_period_secs)
      : eosio::time_point_sec(0);

  Marketplace::update_order(coopname, o.id, [&](auto& upd) {
    upd.status              = OrderStatus::RECEIVED;
    upd.actual_quantity     = actual_quantity;
    upd.fact_cost           = fact_cost;
    upd.issue_act_signiss2  = act;
    upd.warranty_until      = warranty_until;
  });

  // Двухподписный АПП выдачи публикуется в реестр документов в пакете
  // процесса заказа (package = order_hash) — рядом с АПП приёмки.
  Soviet::make_complete_document(_marketplace, coopname, orderer,
                                 "signiss2"_n, order_hash, act);
}
