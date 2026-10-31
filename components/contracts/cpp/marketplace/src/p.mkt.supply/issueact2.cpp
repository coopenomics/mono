/**
 * @brief Закрывающая подпись Акта приёма-передачи (registry 1115)
 * председателем, доверенным или оператором участка выдачи — паевая модель
 * (компонент 68, задача 99D-6). Единственная точка движений по выдаче.
 *
 * В одной транзакции по факту, зафиксированному на issuestmt:
 *  1. обеспечительная часть по факту (задача 99D-18): излишек — o.mkt.refund
 *     на свободный паевой «Стола заказов» (w.mkt.fee → w.mkt.share),
 *     недостаток — o.mkt.fee со свободного паевого (недостающее транслировано
 *     действием convert до заявления); идёт раньше доплаты тела, потому что
 *     обеспечительная часть берётся только со свободного паевого;
 *  2. корректировка резерва: факт меньше заказа — o.mkt.unlock на разницу
 *     (w.mkt.order → w.mkt.share); факт больше — o.mkt.lockp с w.mkt.share и
 *     o.mkt.lock с w.wal.share на остаток (при нехватке — отказ с суммами);
 *  3. o.mkt.consum на fact_cost — BURN w.mkt.order, Дт 80 / Кт 10: возврат
 *     паевого взноса имуществом по протоколу совета; затем факт
 *     обеспечительной части переходит на кошелёк пайщика к списанию
 *     (o.mkt.todue, w.mkt.fee → w.mkt.due). Членским взносом участка он
 *     станет при списании по условиям ЦПП после гарантийного срока
 *     (chargedue) — в этой транзакции проводок по счёту 86 нет;
 *  4. `issueact1 → received`, гарантийное окно, `issue_act2` = акт,
 *     `Soviet::make_complete_document` для акта (пакет = order_hash).
 *
 * Имущество передаётся заказчику только после того, как заказ показан как
 * полученный на экране оператора — так исключается «выдали, а цепь не приняла».
 *
 * Guards:
 *  - actor coopname; order.status == issueact1; на акте есть первая подпись;
 *  - delivery_signer уполномочен на участке выдачи;
 *  - акт подписан заказчиком и delivery_signer (`verify_document_or_fail`).
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::issueact2(eosio::name coopname,
                             eosio::name delivery_signer,
                             checksum256 order_hash,
                             document2 act) {
  require_auth(coopname);

  auto o = Marketplace::get_order_by_hash_or_fail(coopname, order_hash);
  eosio::check(o.status == OrderStatus::ISSUE_ACT1,
               "Закрыть выдачу можно только после первой подписи акта заказчиком");
  eosio::check(!is_empty_document(o.issue_act1),
               "На акте нет первой подписи заказчика");
  eosio::check(is_empty_document(o.issue_act2),
               "Закрывающая подпись акта выдачи уже зафиксирована");

  auto branch = get_branch_or_fail(coopname, o.delivery_braname);
  eosio::check(branch.is_user_authorized(delivery_signer),
               "Подписант со стороны кооператива не уполномочен подписывать акты выдачи данного кооперативного участка");
  eosio::check(!is_empty_document(act), "Отсутствует акт приёма-передачи");
  verify_document_or_fail(act, { o.orderer, delivery_signer });
  // Обе подписи под актом выдачи сделаны ключами своих аккаунтов. Транзакцию шлёт кооператив, поэтому ключ сверяется с аккаунтом.
  verify_signer_keys_or_fail(act, o.orderer);
  verify_signer_keys_or_fail(act, delivery_signer);

  const eosio::asset fact_cost = o.fact_cost;
  eosio::check(fact_cost.amount > 0,
               "Итоговая фактическая сумма заказа должна быть больше нуля");

  // ── 1. Обеспечительная часть по факту — раньше доплаты тела ──
  const eosio::asset locked_fee = Marketplace::get_order_membership_fee(o);
  const eosio::asset fact_fee = locked_fee.amount > 0
      ? Marketplace::pro_rata(locked_fee, fact_cost.amount, o.total_cost.amount)
      : eosio::asset(0, _root_govern_symbol);
  if (fact_fee < locked_fee) {
    Marketplace::refund_secure_part(coopname, o, locked_fee - fact_fee);
  } else if (fact_fee > locked_fee) {
    const eosio::asset fee_diff = fact_fee - locked_fee;
    auto program = Marketplace::get_user_wallet_balance(
        coopname, ledger2_wallets::MARKETPLACE_SHARE_FUND, o.orderer);
    eosio::check(program.available >= fee_diff,
                 std::string{"MARKETPLACE_SECURE_PART_SHORTFALL: Недостаточно свободного паевого Стола заказов на обеспечительную часть доплаты по факту: требуется "} +
                   fee_diff.to_string() + ", доступно " + program.available.to_string() +
                   ". Сначала подайте заявление о трансляции паевого взноса в программу.");
    Marketplace::lock_secure_part(coopname, o.orderer, o.hash, fee_diff,
                                  Marketplace::Memo::get_secure_part_topup_memo(o.id));
  }

  // ── 2. Корректировка резерва по факту ──
  if (fact_cost < o.total_cost) {
    const eosio::asset diff = o.total_cost - fact_cost;
    Ledger2::apply(_marketplace, coopname,
                   operations::marketplace::UNLOCK_ORDER,
                   processes::marketplace::SUPPLY,
                   diff, o.orderer, o.hash,
                   Marketplace::Memo::get_issue_correction_less_memo(o.id));
  } else if (fact_cost > o.total_cost) {
    const eosio::asset diff = fact_cost - o.total_cost;
    // Доплата тела теми же паевыми кошельками, что и заказ: свободный паевой
    // программы, остаток — Цифровой кошелёк (при нехватке — отказ с суммами).
    Marketplace::lock_order_body(coopname, o.id, o.orderer, o.hash, diff,
                                 Marketplace::Memo::get_issue_correction_more_block_memo(o.id),
                                 Marketplace::Memo::get_issue_correction_more_block_memo(o.id));
  }

  // ── 3. Возврат паевого взноса имуществом; обеспечительная часть к списанию ──
  Ledger2::apply(_marketplace, coopname,
                 operations::marketplace::CONSUME_BY_MEMBER,
                 processes::marketplace::SUPPLY,
                 fact_cost, o.orderer, o.hash,
                 Marketplace::Memo::get_consume_by_member_memo(o.id));

  Marketplace::move_secure_part_to_due(coopname, o, fact_fee);

  // ── 4. Статус, гарантия, документ ──
  const auto now = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());
  const auto warranty_until = (o.warranty_period_secs > 0)
      ? eosio::time_point_sec(now.sec_since_epoch() + o.warranty_period_secs)
      : eosio::time_point_sec(0);

  Marketplace::update_order(coopname, o.id, [&](auto& upd) {
    upd.status         = OrderStatus::RECEIVED;
    upd.issue_act2     = act;
    upd.warranty_until = warranty_until;
  });

  Soviet::make_complete_document(_marketplace, coopname, o.orderer,
                                 "issueact2"_n, order_hash, act);
}
