/**
 * @brief Довнесение членского взноса по гарантийному возврату, который ждал
 * пополнения общего кошелька участка (p.mkt.return, задача 99D-15).
 *
 * Совет отменил сделку (`onmktrtauth`): имущество на складе, паевой взнос
 * заказчика восстановлен, но общий кошелёк участка к тому моменту был уже
 * распределён, и взнос вернуть было не из чего. Заявка осталась в статусе
 * `feepend`. Когда председатель пополнил кошелёк участка, бэкенд по
 * расписанию зовёт это действие: взнос уходит из общего кошелька участка в
 * пул взносов (o.brn.retfee) и из пула на членский кошелёк программы
 * заказчика (o.mkt.refund), заявка стирается.
 *
 * Участок берётся из заказа (`delivery_braname`): заказ живёт, пока по нему
 * открыта заявка на возврат (`closeorder` это проверяет).
 *
 * Guards:
 *  - заявка существует и в статусе `feepend`;
 *  - в общем кошельке участка достаточно средств — иначе отказ с суммой
 *    (проверка `branch::retfee`), и следующая попытка идёт по расписанию.
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::payretfee(eosio::name coopname, checksum256 request_hash) {
  require_auth(coopname);

  auto r = Marketplace::get_return_request_by_hash_or_fail(coopname, request_hash);
  eosio::check(r.status == ReturnStatus::FEE_PENDING,
               "Заявление на возврат не ожидает довнесения членского взноса");
  eosio::check(r.fee_refund.amount > 0, "По заявлению на возврат нет взноса к довнесению");

  auto o = Marketplace::get_order_by_hash_or_fail(coopname, r.original_order_hash);
  Marketplace::refund_return_fee(coopname, o.delivery_braname, r);

  Marketplace::erase_return_request(coopname, r.id);
}
