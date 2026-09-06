/**
 * @brief Закрывающая подпись Акта приёма-передачи (registry 1115)
 * председателем, доверенным или оператором участка выдачи — паевая модель
 * (компонент 68, задача 99D-6). Единственная точка движений по выдаче.
 *
 * В одной транзакции по факту, зафиксированному на issuestmt:
 *  1. корректировка резерва: факт меньше заказа — o.mkt.unlock на разницу
 *     (w.mkt.order → w.mkt.share); факт больше — o.mkt.lockp с w.mkt.share
 *     (при нехватке — отказ с суммами; автоматического добора с паевого
 *     Цифрового кошелька нет);
 *  2. o.mkt.consum на fact_cost — BURN w.mkt.order, Дт 80 / Кт 10: возврат
 *     паевого взноса имуществом по протоколу совета;
 *  3. членский взнос участка по факту: излишек — o.mkt.refund (Дт 86 / Кт 80),
 *     недостаток — o.mkt.lockpf (Дт 80 / Кт 86), затем branch::accrue → 100 %
 *     факта взноса в общий кошелёк участка выдачи;
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

  const eosio::asset fact_cost = o.fact_cost;
  eosio::check(fact_cost.amount > 0,
               "Итоговая фактическая сумма заказа должна быть больше нуля");

  // ── 1. Корректировка резерва по факту ──
  if (fact_cost < o.total_cost) {
    const eosio::asset diff = o.total_cost - fact_cost;
    Ledger2::apply(_marketplace, coopname,
                   operations::marketplace::UNLOCK_ORDER,
                   processes::marketplace::SUPPLY,
                   diff, o.orderer, o.hash,
                   Marketplace::Memo::get_issue_correction_less_memo(o.id));
  } else if (fact_cost > o.total_cost) {
    const eosio::asset diff = fact_cost - o.total_cost;
    auto bal_share = Marketplace::get_user_wallet_balance(
        coopname, ledger2_wallets::MARKETPLACE_SHARE_FUND, o.orderer);
    eosio::check(bal_share.available >= diff,
                 std::string{"Недостаточно паевых средств «Стола заказов» для доплаты по факту: требуется "} +
                   diff.to_string() + ", доступно " + bal_share.available.to_string() +
                   ". Уменьшите состав выдачи либо пополните паевой взнос и повторите.");
    Ledger2::apply(_marketplace, coopname,
                   operations::marketplace::LOCK_FROM_SHARE,
                   processes::marketplace::SUPPLY,
                   diff, o.orderer, o.hash,
                   Marketplace::Memo::get_issue_correction_more_block_memo(o.id));
  }

  // ── 2. Возврат паевого взноса имуществом ──
  Ledger2::apply(_marketplace, coopname,
                 operations::marketplace::CONSUME_BY_MEMBER,
                 processes::marketplace::SUPPLY,
                 fact_cost, o.orderer, o.hash,
                 Marketplace::Memo::get_consume_by_member_memo(o.id));

  // ── 3. Членский взнос участка по факту ──
  const eosio::asset locked_fee = Marketplace::get_order_membership_fee(o);
  if (locked_fee.amount > 0) {
    const eosio::asset fact_fee =
        Marketplace::pro_rata(locked_fee, fact_cost.amount, o.total_cost.amount);
    if (fact_fee < locked_fee) {
      Ledger2::apply(_marketplace, coopname,
                     operations::marketplace::MEMBERSHIP_FEE_REFUND,
                     processes::marketplace::SUPPLY,
                     locked_fee - fact_fee, o.orderer, o.hash,
                     Marketplace::Memo::get_membership_fee_refund_memo(o.id));
    } else if (fact_fee > locked_fee) {
      const eosio::asset fee_diff = fact_fee - locked_fee;
      auto bal_share_fee = Marketplace::get_user_wallet_balance(
          coopname, ledger2_wallets::MARKETPLACE_SHARE_FUND, o.orderer);
      eosio::check(bal_share_fee.available >= fee_diff,
                   std::string{"Недостаточно паевых средств «Стола заказов» для довзноса по факту: требуется "} +
                     fee_diff.to_string() + ", доступно " + bal_share_fee.available.to_string() +
                     ". Уменьшите состав выдачи либо пополните паевой взнос и повторите.");
      Ledger2::apply(_marketplace, coopname,
                     operations::marketplace::LOCK_FEE_FROM_SHARE,
                     processes::marketplace::SUPPLY,
                     fee_diff, o.orderer, o.hash,
                     Marketplace::Memo::get_membership_fee_topup_memo(o.id));
    }
    if (fact_fee.amount > 0) {
      Branch::accrue(_marketplace, coopname, o.delivery_braname,
                     fact_fee, processes::marketplace::SUPPLY, o.hash,
                     Marketplace::Memo::get_membership_fee_distribute_memo(o.id));
    }
  }

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
