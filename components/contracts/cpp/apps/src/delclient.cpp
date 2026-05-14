/**
 * \brief Отозвать кооператив-клиента каталога (Story v2.4.1, FR8).
 * \ingroup public_apps_actions
 *
 * Что делает действие:
 *  1. Требует `catalog_operator @ active` — `require_auth(catalog_operator)`.
 *  2. Валидирует, что `client_coopname` непустое.
 *  3. Удаляет row по primary key. Если row нет → `eosio_assert("client not found")`.
 *     Идемпотентность сознательно НЕ соблюдается: повторный `delclient`
 *     должен вернуть явную ошибку, чтобы вышестоящие watcher'ы
 *     (cache-invalidation, JWT-revocation в CA) могли отличить «уже
 *     отзывали» от «никогда не было».
 *
 * **Эффекты на TS-стороне** (живут в `apps-catalog`, не на цепи):
 *  - membership-cache для `client_coopname` инвалидируется через
 *    hybrid-TTL (D9): критический путь забирает уже актуальный ответ
 *    из chain'а, read-API получает stale-ответ ≤ 60s.
 *  - JWT с `coopname=client_coopname` помещаются в `JwtRevokeList`
 *    (FR15): пока не истечёт TTL токена — он отозван по jti.
 *
 * RAM payer возвращается `catalog_operator`. `subs` записи кооператива
 * НЕ удаляются автоматически — это решение оператора, и история
 * подписок остаётся в `subs` для аудита (флаг `active=false`
 * выставляется отдельным `expsub`-вызовом).
 */
void apps::delclient(eosio::name catalog_operator,
                     eosio::name client_coopname) {
  require_auth(catalog_operator);

  eosio::check(catalog_operator.value != 0, "catalog_operator must not be empty");
  eosio::check(client_coopname.value != 0, "client_coopname must not be empty");

  clients_index clients(get_self(), catalog_operator.value);
  auto it = clients.find(client_coopname.value);
  eosio::check(it != clients.end(), "client not found");

  clients.erase(it);
}
