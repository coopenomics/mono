/**
 * \brief Установить `attempt`-счётчик в `regsub` (D4 retry-management).
 * \ingroup public_apps_actions
 *
 * Pricing-watcher CA вызывает это действие, когда `ack=declined` или
 * charge не дошёл, для отметки факта повторной попытки. Контракт
 * не вычисляет `current+1` сам — watcher держит state в Postgres
 * (charge_intents.attempt) и передаёт нужное значение явно. Так проще:
 * любая ошибочная гонка фиксируется на уровне Postgres-инкремента,
 * а контракт остаётся stateless относительно retry-логики.
 *
 *  - `extendsub` сам сбрасывает `attempt=0` при удачном charge'е, поэтому
 *    pricing-watcher не должен дёргать `setattempt(0)` после успеха.
 *  - При `attempt > globals.retry_max` watcher эмитит
 *    `SubscriptionExpiredError` (story v2.6.9) и прекращает попытки;
 *    контракт это знание не дублирует — `retry_max` хранится в
 *    `globals` singleton и читается только off-chain.
 */
void apps::setattempt(eosio::name catalog_operator,
                      eosio::name subscriber,
                      eosio::name package_id,
                      uint8_t attempt) {
  require_auth(catalog_operator);

  eosio::check(subscriber.value != 0, "subscriber must not be empty");
  eosio::check(package_id.value != 0, "package_id must not be empty");

  subs_index subs(_apps, _apps.value);
  auto by_cooppkg = subs.get_index<"bycooppkg"_n>();
  uint128_t key = ((uint128_t)subscriber.value << 64) | package_id.value;
  auto it = by_cooppkg.find(key);
  eosio::check(it != by_cooppkg.end(), "subscription not found");

  auto now = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());
  by_cooppkg.modify(it, catalog_operator, [&](auto &s) {
    s.attempt    = attempt;
    s.updated_at = now;
  });
}
