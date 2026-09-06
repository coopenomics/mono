/**
 * @brief Заказчик на пункте выдачи подписывает Заявление о возврате паевого
 * взноса имуществом (registry 1113) на фактический состав после сверки
 * (паевая модель, компонент 68, задача 99D-6).
 *
 * Эффект:
 *  - факт фиксируется в заказе (`actual_quantity`, `fact_cost` = количество ×
 *    фактическая цена за единицу отпуска);
 *  - `issue_statement` = заявление, статус `readyrecv → issuepend`;
 *  - инлайн `soviet::createagenda` от `permission_level{_marketplace, active}`
 *    с `type=mktissue`, `hash=order_hash`, обратными вызовами `onmktisauth` /
 *    `onmktisdecl` и заявлением как документом повестки. Мост повестки
 *    целиком на контракте — как в propwroff.
 *
 * Движений по средствам нет: до закрывающей подписи акта ничего не состоялось.
 * Достаточность свободного паевого на доплату при факте больше заказа
 * проверяется здесь заранее, чтобы отказ был виден до решения совета; на
 * issueact2 проверка повторяется.
 *
 * Guards:
 *  - actor coopname (require_auth);
 *  - orderer — заказчик заказа; order.status == readyrecv;
 *  - количество кратно упаковке, цена в валюте кооператива и больше нуля;
 *  - заявление подписано заказчиком (`verify_document_or_fail`).
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::issuestmt(eosio::name coopname,
                             eosio::name orderer,
                             checksum256 order_hash,
                             eosio::asset actual_quantity,
                             eosio::asset actual_unit_price,
                             document2 statement,
                             std::string meta) {
  require_auth(coopname);
  Marketplace::check_quantity(actual_quantity);
  eosio::check(actual_unit_price.symbol == _root_govern_symbol,
               "Фактическая цена за единицу указана в неверной валюте");
  eosio::check(actual_unit_price.amount > 0,
               "Фактическая цена за единицу должна быть больше нуля");

  auto o = Marketplace::get_order_by_hash_or_fail(coopname, order_hash);
  eosio::check(o.orderer == orderer, "Вы не заказчик этого заказа");
  eosio::check(o.status == OrderStatus::READY_TO_RECEIVE,
               "Заказ не готов к выдаче");
  eosio::check(actual_quantity.symbol == o.quantity.symbol,
               "Единица измерения фактического количества не совпадает с заказом");
  Marketplace::check_packaging(actual_quantity, o.package_size);

  eosio::check(!is_empty_document(statement),
               "Отсутствует заявление о возврате паевого взноса имуществом");
  verify_document_or_fail(statement, { orderer });

  const eosio::asset fact_cost =
      Marketplace::calc_cost(actual_quantity, actual_unit_price, o.package_size);
  eosio::check(fact_cost.amount > 0,
               "Итоговая фактическая сумма заказа должна быть больше нуля");

  // Заранее: хватит ли свободного паевого «Стола заказов» на доплату и довзнос
  // при факте больше заказа. Движения — только на issueact2.
  if (fact_cost > o.total_cost) {
    eosio::asset need = fact_cost - o.total_cost;
    const eosio::asset locked_fee = Marketplace::get_order_membership_fee(o);
    if (locked_fee.amount > 0) {
      const eosio::asset fact_fee =
          Marketplace::pro_rata(locked_fee, fact_cost.amount, o.total_cost.amount);
      if (fact_fee > locked_fee) need += (fact_fee - locked_fee);
    }
    auto bal_share = Marketplace::get_user_wallet_balance(
        coopname, ledger2_wallets::MARKETPLACE_SHARE_FUND, orderer);
    eosio::check(bal_share.available >= need,
                 std::string{"Недостаточно паевых средств «Стола заказов» для доплаты по факту: требуется "} +
                   need.to_string() + ", доступно " + bal_share.available.to_string() +
                   ". Уменьшите состав выдачи до суммы, на которую хватает, либо пополните паевой взнос.");
  }

  Marketplace::update_order(coopname, o.id, [&](auto& upd) {
    upd.status          = OrderStatus::ISSUE_PENDING;
    upd.actual_quantity = actual_quantity;
    upd.fact_cost       = fact_cost;
    upd.issue_statement = statement;
  });

  // Повестка совета: marketplace в contracts_whitelist, createagenda
  // авторизуется от permission_level{_marketplace, active}; hash = order_hash,
  // чтобы обратные вызовы нашли заказ.
  action(permission_level{_marketplace, "active"_n}, _soviet, "createagenda"_n,
    std::make_tuple(
      coopname,
      orderer,
      get_valid_soviet_action(_marketplace_issue_action),
      order_hash,
      _marketplace,
      "onmktisauth"_n,
      "onmktisdecl"_n,
      statement,
      meta
    )
  ).send();
}
