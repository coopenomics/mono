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
 * Сумма выдачи не выше стоимости заказа: доплаты по заказу нет (решение
 * владельца 07.11.2026). Добрать имущество сверх заказа пайщик может
 * докладкой из остатка участка — она идёт отдельными заказами.
 *
 * Guards:
 *  - actor coopname (require_auth);
 *  - orderer — заказчик заказа; order.status == readyrecv;
 *  - количество кратно упаковке, цена в валюте кооператива и больше нуля;
 *  - цену при выдаче можно только снизить: по заказу из остатка — не выше
 *    цены заказа, по заказу поставщика — сумма выдачи не выше принятой
 *    стоимости (снижение затем выбывает уценкой `markdown`);
 *  - сумма выдачи не выше стоимости заказа;
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
  // Заявление подписывает сам заказчик. Транзакцию шлёт кооператив, поэтому ключ сверяется с аккаунтом.
  verify_signer_keys_or_fail(statement, orderer);

  const eosio::asset fact_cost =
      Marketplace::calc_cost(actual_quantity, actual_unit_price, o.package_size);
  eosio::check(fact_cost.amount > 0,
               "Итоговая фактическая сумма заказа должна быть больше нуля");

  // Цену при выдаче можно только снизить (решение владельца 10.09.2026):
  // имущество числится на складе по цене приёмки, снижение выбывает уценкой
  // (`markdown`, Дт 91 / Кт 10), а повышению закрыться нечем — доходной
  // проводки в модели нет. Цену приёмки за единицу контракт не хранит, поэтому
  // по заказу поставщика держится сумма: выдать дороже принятого нельзя;
  // потолок за единицу по цене прибытия держит бэкенд.
  if (o.offerer == coopname) {
    eosio::check(actual_unit_price <= o.unit_price,
                 "Цену при выдаче можно только снизить: по заказу из остатка кооператива — не выше цены заказа");
  } else {
    eosio::check(fact_cost <= Marketplace::get_accepted_cost(o),
                 "Цену при выдаче можно только снизить: сумма выдачи не может превышать стоимость, по которой имущество принято кооперативом");
  }

  // Доплаты по заказу нет (решение владельца 07.11.2026): приёмка и выдача не
  // берут дороже и больше заказа, а имущество сверх заказа идёт докладкой из
  // остатка отдельными заказами. До 07.11.2026 здесь проверялись средства на
  // доплату тела и обеспечительной части по факту.
  eosio::check(fact_cost <= o.total_cost,
               "MARKETPLACE_ISSUE_FACT_EXCEEDS_ORDER: Сумма выдачи не может превышать стоимость заказа");

  Marketplace::update_order(coopname, o.id, [&](auto& upd) {
    upd.status          = OrderStatus::ISSUE_PENDING;
    upd.actual_quantity = actual_quantity;
    upd.fact_cost       = fact_cost;
    upd.issue_statement.emplace(statement);
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
