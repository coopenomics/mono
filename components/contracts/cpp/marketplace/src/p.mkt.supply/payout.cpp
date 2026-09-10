/**
 * @brief Инициация исходящей выплаты поставщику по одному Order'у через gateway
 * (E11 техдолг 598-16, Locked Decision L12, p.mkt.supply).
 *
 * Backend дёргает это действие, когда кассир в админке отметил готовность
 * проводить выплату поставщику. Проводки Дт 76 / Кт 51 здесь нет — она
 * произойдёт в callback'е `payconfirm` после фактического банковского перевода
 * (gateway::outcomplete вызывает кассир через свой стол), либо отменится в
 * `paydecline` (gateway::outdecline). Действие лишь inline-вызовом регистрирует
 * в gateway::outcomes запись типа «исходящий платёж» со статусом pending и
 * привязанным callback'ом на marketplace.
 *
 * Inline-вызов: `gateway::createoutpay` с `callback_contract = _marketplace`,
 * `confirm_callback = "payconfirm"_n`, `decline_callback = "paydecline"_n`,
 * `outcome_hash = order.hash` (уникальность гарантирована индексом orders).
 *
 * Сумма выплаты — принятая стоимость `accepted_cost` (факт закрывающей подписи
 * приёмки), а НЕ `o.total_cost` (исходный заказ) и НЕ `o.fact_cost` (его
 * перезаписывает заявление о выдаче): при отбраковке части поставки на приёмке
 * кооператив должен поставщику ровно принятое, и эта сумма совпадает с
 * приходованием имущества Кт 76 и с суммой платежа в реестре платежей
 * кооператива независимо от того, сколько потом выдали пайщику (задача 99D-14).
 *
 * Удержание признанного гарантийного долга (w.mkt.debt, задача 99D-13)
 * проводится ЗДЕСЬ, при инициации: o.mkt.deduct (BURN с кошелька долга, без
 * проводки — обязательство и дебиторка на одном счёте 76) гасит долг в момент,
 * когда сумма перевода определена. Гасить его при подтверждении кассира нельзя:
 * пока выплата ждёт кассира, остаток долга на кошельке не меняется, и вторая
 * выплата тому же поставщику удержала бы тот же долг ещё раз — а её
 * подтверждение сжигало бы больше, чем осталось, и падало вместе с действием
 * кассира (задача 99D-15). После инициации `payout_withheld` и `accepted_cost`
 * не меняются: `payconfirm` проводит ровно `accepted_cost − payout_withheld`.
 *
 * Повторная инициация после `paydecline` удержание не повторяет: уже
 * удержанное остаётся в `payout_withheld`, доудерживается только новый долг,
 * признанный с тех пор, и только в пределах ещё не выплаченного остатка.
 *
 * Status Order'а не меняется (выплата может идти параллельно шагам выдачи).
 * payout_status переходит NONE/DECLINED → PENDING; declined-кейс — повторная
 * попытка после исправления реквизитов (gateway-запись была стёрта на outdecline).
 *
 * Guards:
 *  - Order существует и приёмка завершена (статус ∈ accepted_to_coop /
 *    ready_to_receive / received / refused — после отказа пайщика долг
 *    поставщику всё равно гасится).
 *  - payout_status ∈ { NONE, DECLINED } — нельзя инициировать выплату поверх
 *    pending или completed.
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::payout(eosio::name coopname, checksum256 order_hash) {
  require_auth(coopname);

  auto o = Marketplace::get_order_by_hash_or_fail(coopname, order_hash);
  eosio::check(o.offerer != coopname,
               "По заказу из остатка кооператива выплата поставщику не предусмотрена: имущество уже оплачено при первичной приёмке");
  eosio::check(o.status == OrderStatus::ACCEPTED_TO_COOP ||
               o.status == OrderStatus::READY_TO_RECEIVE ||
               o.status == OrderStatus::RECEIVED ||
               o.status == OrderStatus::REFUSED,
               "Выплата возможна только после приёмки имущества кооперативом");
  eosio::check(o.payout_status == OrderPayoutStatus::NONE ||
               o.payout_status == OrderPayoutStatus::DECLINED,
               "Выплата уже инициирована либо завершена");

  const eosio::asset accepted_cost = Marketplace::get_accepted_cost(o);

  // Уже удержанное прошлой (отклонённой кассиром) инициацией: долг по нему
  // сожжён тогда же, повторно не удерживается.
  const eosio::asset already_withheld = o.payout_withheld.has_value()
      ? o.payout_withheld.value()
      : eosio::asset(0, _root_govern_symbol);
  eosio::check(already_withheld <= accepted_cost,
               "Удержанный долг превышает принятую стоимость заказа");
  const eosio::asset outstanding = accepted_cost - already_withheld;

  // Новое удержание — остаток признанного долга поставщика, не больше ещё не
  // выплаченного по заказу. Долг гасится сразу: следующая выплата тому же
  // поставщику увидит уже уменьшенный остаток.
  const auto debt = Marketplace::get_user_wallet_balance(coopname, ledger2_wallets::MARKETPLACE_SUPPLIER_DEBT, o.offerer);
  eosio::asset deducted_now(0, _root_govern_symbol);
  if (debt.exists && debt.available.amount > 0 && outstanding.amount > 0) {
    deducted_now = debt.available.amount < outstanding.amount ? debt.available : outstanding;
    Ledger2::apply(_marketplace, coopname,
                   operations::marketplace::DEDUCT_DEBT,
                   processes::marketplace::SUPPLY,
                   deducted_now, o.offerer, o.hash,
                   Marketplace::Memo::get_deduct_debt_memo(o.id));
    // Той же суммой уменьшается и сумма к оплате поставщику: долг и
    // обязательство на одном счёте 76 сворачиваются (задача 99D-16).
    Ledger2::apply(_marketplace, coopname,
                   operations::marketplace::OFFSET_PAYABLE,
                   processes::marketplace::SUPPLY,
                   deducted_now, o.offerer, o.hash,
                   Marketplace::Memo::get_deduct_debt_memo(o.id));
  }
  const eosio::asset withheld = already_withheld + deducted_now;
  const eosio::asset to_pay = accepted_cost - withheld;

  if (to_pay.amount == 0) {
    // Долг покрывает всю выплату: банковского перевода не будет, удержание
    // уже проведено, выплата считается завершённой.
    if (o.status == OrderStatus::REFUSED) {
      // Пайщик уже отказался, заказ ждал только расчёта с поставщиком —
      // расчёт закрыт удержанием, запись больше не нужна.
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

  // Регистрация исходящего платежа в gateway на принятую сумму за вычетом
  // удержания. Сам Дт 76 / Кт 51 произойдёт в callback'е `payconfirm` от
  // gateway после действия кассира — на ту же сумму: accepted_cost и
  // payout_withheld после этого шага не меняются.
  Gateway::create_outcome(_marketplace, coopname, o.offerer, o.hash, to_pay,
                          _marketplace, "payconfirm"_n, "paydecline"_n);

  Marketplace::update_order(coopname, o.id, [&](auto& upd) {
    upd.payout_status = OrderPayoutStatus::PENDING;
    upd.payout_decline_reason.clear();  // на случай повторной инициации после DECLINED
    upd.payout_withheld.emplace(withheld);
  });
}
