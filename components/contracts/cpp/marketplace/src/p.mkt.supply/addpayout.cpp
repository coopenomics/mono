/**
 * @brief Заказ включается в пакет выплаты поставщику (решение владельца
 * 19.11.2026, p.mkt.supply).
 *
 * Узел в конце дня собирает по каждому поставщику принятые и ещё не оплаченные
 * заказы в один пакет: по одному действию на заказ, затем `sendpayout`.
 * Сумму пакета считает контракт. К пакету прибавляется принятая стоимость
 * заказа `accepted_cost` за вычетом удержания признанного гарантийного долга
 * поставщика. Сумма заказа — факт закрывающей подписи приёмки, не исходный
 * заказ и не факт выдачи (задача 99D-14).
 *
 * Удержание долга (w.mkt.debt, задача 99D-13) проводится здесь: o.mkt.deduct
 * гасит долг в момент, когда сумма перевода по заказу определена, и
 * o.mkt.offset той же суммой уменьшает долг перед поставщиком (задача 99D-16).
 * Следующий заказ пакета видит уже уменьшенный остаток долга, поэтому один
 * долг дважды не удерживается (задача 99D-15). Повторное включение после
 * отказа кассира удержание не повторяет: удержанное остаётся в
 * `payout_withheld`, доудерживается только новый долг.
 *
 * Долг покрыл всю стоимость заказа — перевода по заказу нет: заказ в пакет не
 * включается, выплата по нему завершена сразу (заказ после отказа пайщика
 * стирается).
 *
 * Первое действие с новым хэшем заводит пакет; хэш называет узел, он же
 * `outcome_hash` исходящего платежа. В открытый пакет добавляются только заказы
 * того же поставщика.
 *
 * Guards:
 *  - заказ не из остатка кооператива и принят кооперативом (accepted_to_coop /
 *    ready_to_receive / received / refused);
 *  - выплата по заказу не начата либо отклонена кассиром (payout_status ∈
 *    { none, declined });
 *  - пакет открыт и принадлежит тому же поставщику.
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::addpayout(eosio::name coopname, checksum256 payout_hash, checksum256 order_hash) {
  require_auth(coopname);
  eosio::check(payout_hash != checksum256(), "MARKETPLACE_PAYOUT_HASH_EMPTY: Хэш пакета выплаты не задан");

  auto o = Marketplace::get_order_by_hash_or_fail(coopname, order_hash);
  eosio::check(o.offerer != coopname,
               "MARKETPLACE_PAYOUT_COOP_STOCK: По заказу из остатка кооператива выплата поставщику не предусмотрена: имущество уже оплачено при первичной приёмке");
  eosio::check(o.status == OrderStatus::ACCEPTED_TO_COOP ||
               o.status == OrderStatus::READY_TO_RECEIVE ||
               o.status == OrderStatus::RECEIVED ||
               o.status == OrderStatus::REFUSED,
               "MARKETPLACE_PAYOUT_NOT_ACCEPTED: Выплата возможна только после приёмки имущества кооперативом");
  eosio::check(o.payout_status == OrderPayoutStatus::NONE ||
               o.payout_status == OrderPayoutStatus::DECLINED,
               "MARKETPLACE_PAYOUT_ALREADY_STARTED: Выплата по заказу уже включена в пакет либо завершена");

  const eosio::asset accepted_cost = Marketplace::get_accepted_cost(o);

  // Уже удержанное прошлым включением (пакет отклонён кассиром): долг по нему
  // сожжён тогда же, повторно не удерживается.
  const eosio::asset already_withheld = Marketplace::get_payout_withheld(o);
  eosio::check(already_withheld <= accepted_cost,
               "MARKETPLACE_PAYOUT_WITHHELD_EXCEEDS: Удержанный долг превышает принятую стоимость заказа");
  const eosio::asset outstanding = accepted_cost - already_withheld;

  const auto debt = Marketplace::get_user_wallet_balance(coopname, ledger2_wallets::MARKETPLACE_SUPPLIER_DEBT, o.offerer);
  eosio::asset deducted_now(0, _root_govern_symbol);
  if (debt.exists && debt.available.amount > 0 && outstanding.amount > 0) {
    deducted_now = debt.available.amount < outstanding.amount ? debt.available : outstanding;
    Ledger2::apply(_marketplace, coopname,
                   operations::marketplace::DEDUCT_DEBT,
                   processes::marketplace::SUPPLY,
                   deducted_now, o.offerer, o.hash,
                   Marketplace::Memo::get_deduct_debt_memo(o.id));
    Ledger2::apply(_marketplace, coopname,
                   operations::marketplace::OFFSET_PAYABLE,
                   processes::marketplace::SUPPLY,
                   deducted_now, o.offerer, o.hash,
                   Marketplace::Memo::get_deduct_debt_memo(o.id));
  }
  const eosio::asset withheld = already_withheld + deducted_now;
  const eosio::asset to_pay = accepted_cost - withheld;

  if (to_pay.amount == 0) {
    // Долг покрыл всю стоимость заказа: перевода нет, выплата завершена.
    if (o.status == OrderStatus::REFUSED) {
      Marketplace::erase_order(coopname, o.id);
      return;
    }
    Marketplace::update_order(coopname, o.id, [&](auto& upd) {
      upd.payout_status = OrderPayoutStatus::COMPLETED;
      upd.payout_decline_reason.clear();
      upd.payout_withheld.emplace(withheld);
    });
    return;
  }

  payouts_index payouts(_marketplace, coopname.value);
  auto by_hash = payouts.get_index<"byhash"_n>();
  auto it = by_hash.find(payout_hash);
  if (it == by_hash.end()) {
    payouts.emplace(RamPayer::of(payouts, coopname), [&](auto& p) {
      p.id = payouts.available_primary_key();
      p.hash = payout_hash;
      p.offerer = o.offerer;
      p.status = PayoutStatus::OPEN;
      p.amount = to_pay;
      p.withheld = withheld;
      p.orders = 1;
      p.created_at = eosio::time_point_sec(eosio::current_time_point());
    });
  } else {
    eosio::check(it->status == PayoutStatus::OPEN,
                 "MARKETPLACE_PAYOUT_NOT_OPEN: Пакет выплаты уже отправлен кассиру, заказ попадёт в следующий пакет");
    eosio::check(it->offerer == o.offerer,
                 "MARKETPLACE_PAYOUT_OFFERER_MISMATCH: В пакет выплаты включаются заказы только одного поставщика");
    by_hash.modify(it, RamPayer::of(payouts, coopname), [&](auto& p) {
      p.amount += to_pay;
      p.withheld += withheld;
      p.orders += 1;
    });
  }

  Marketplace::update_order(coopname, o.id, [&](auto& upd) {
    upd.payout_status = OrderPayoutStatus::PENDING;
    upd.payout_decline_reason.clear();
    upd.payout_withheld.emplace(withheld);
    upd.payout_hash.emplace(payout_hash);
  });
}
