/**
 * @brief Председатель приёмного КУ ставит закрывающую подпись на АПП приёмки
 * по одному Order'у (Story 5.3/5.4, p.mkt.supply).
 *
 * Per-Order — только бухгалтерская приёмка имущества:
 *  - Ledger2::apply(o.mkt.purch, fact_cost, …, hash=order.hash) — Дт 10 / Кт 86.
 *
 * Факт приёмки (кол-во и цена за единицу) корректируется оператором при
 * открытии приёмки и зашивается в акт, который утверждает поставщик: привезли
 * меньше / другого качества → принимаем со скидкой. Кооператив приходует
 * поставщику итоговую `fact_cost = actual_quantity × actual_unit_price`, а не
 * исходную `o.total_cost`. Резерва пайщика на приёмке нет, поэтому веток
 * возврата/доплаты (как в signiss2) здесь не требуется — это просто итоговая
 * стоимость к получению поставщиком.
 *
 * Имущество приходуется на склад приёмного КУ (`accept_braname`); у кооператива
 * возникает обязательство Кт 86 перед поставщиком. Фактическая выплата деньгами
 * (Дт 86 / Кт 51) — отдельным lazy action'ом `marketplace::payout` после
 * подтверждения кассиром реального банковского перевода (Locked Decision L12,
 * E11 техдолг 598-16).
 *
 * Status: supply_prepared → accepted_to_coop. acceptance_act_signchair
 * сохраняется. `payout_done` не выставляется — это атрибут payout-действия.
 *
 * Guards:
 *  - Order существует и в статусе supply_prepared.
 *  - Подписант (`signer`) авторизован для приёмного КУ — председатель,
 *    trustee либо доверенное лицо в `branches[accept_braname].trusted[]`.
 *  - На акте есть подписи поставщика и подписанта приёмки.
 *  - actual_quantity > 0; actual_unit_price > 0 и в валюте кооператива.
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::signchair(eosio::name coopname,
                             eosio::name signer,
                             checksum256 order_hash,
                             uint64_t actual_quantity,
                             eosio::asset actual_unit_price,
                             document2 act) {
  require_auth(coopname);
  eosio::check(actual_quantity > 0, "Фактическое количество должно быть больше нуля");
  eosio::check(actual_unit_price.symbol == _root_govern_symbol,
               "Фактическая цена за единицу указана в неверной валюте");
  eosio::check(actual_unit_price.amount > 0,
               "Фактическая цена за единицу должна быть больше нуля");

  auto o = Marketplace::get_order_by_hash_or_fail(coopname, order_hash);
  eosio::check(o.status == OrderStatus::SUPPLY_PREPARED,
               "Заказ не готов к приёмке кооперативом");

  // Авторизация подписи: signer должен быть в trusted списке приёмного КУ.
  auto branch = get_branch_or_fail(coopname, o.accept_braname);
  eosio::check(branch.is_user_authorized(signer),
               "Подписант не уполномочен подписывать акты приёмки данного кооперативного участка");

  verify_document_or_fail(act, { o.offerer, signer });

  // Итоговая стоимость к получению поставщиком — от скорректированного факта.
  const eosio::asset fact_cost = eosio::asset(
      static_cast<int64_t>(actual_quantity) * actual_unit_price.amount,
      _root_govern_symbol);
  eosio::check(fact_cost.amount > 0,
               "Итоговая фактическая сумма приёмки должна быть больше нуля");

  // Только приёмка имущества; payout — отдельный lazy action (L12).
  Ledger2::apply(_marketplace, coopname,
                 operations::marketplace::PURCHASE_FROM_SUPPLIER,
                 fact_cost, o.offerer, o.hash,
                 Marketplace::Memo::get_purchase_from_supplier_memo(o.id));

  Marketplace::update_order(coopname, o.id, [&](auto& upd) {
    upd.status = OrderStatus::ACCEPTED_TO_COOP;
    upd.actual_quantity = actual_quantity;
    upd.fact_cost = fact_cost;
    upd.acceptance_act_signchair = act;
    upd.current_warehouse_braname = o.accept_braname;  // имущество на приёмном складе
  });

  // Двухподписный АПП приёмки публикуется в реестр документов в пакете
  // процесса заказа (package = order_hash): оба акта приёма-передачи и
  // документы гарантийного возврата группируются вокруг одного заказа.
  Soviet::make_complete_document(_marketplace, coopname, o.offerer,
                                 "signchair"_n, order_hash, act);
}
