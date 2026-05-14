/**
 * \brief Зарегистрировать кооператив-клиента каталога (Story v2.4.1).
 * \ingroup public_apps_actions
 *
 * Что делает действие:
 *  1. Требует подпись `catalog_operator @ active` —
 *     `require_auth(catalog_operator)`. В MVP это всегда `voskhod`,
 *     но контракт не хардкодит имя — на проверке authority единственное
 *     допустимое подписавшее лицо это и есть scope записи.
 *  2. Валидирует, что `client_coopname` непустое (eosio::name(0) —
 *     особое значение «отсутствие», не валидное имя).
 *  3. Идемпотентно с проверкой: row нет → `emplace`. Row есть →
 *     `eosio_assert("client already registered")`. Это намеренный
 *     «строгий» upsert — повторный `regclient` без явного `delclient`
 *     должен ловить ошибки оператора (двойной вызов из-за UI-сбоя).
 *
 * RAM payer — `catalog_operator`. ВОСХОД оплачивает RAM записи как
 * часть стоимости подключения кооператива; клиент за хранение `clients`-row
 * не платит.
 *
 * Что **не делает** (выносится в TS-сторону, Story v2.4.5):
 *  - Не валидирует наличие `coops`-записи у `client_coopname`. Кооператив
 *    может быть подключён к каталогу до того, как оформлен в `coops`
 *    (signing_key, chain_id — это уровень subnet-операций). Каталог
 *    проверит это сам перед issue'ем JWT.
 *  - Не выпускает события / webhook'и. Audit-trail off-chain в
 *    `audit_log_admin` через `regsub`-watcher CA.
 */
void apps::regclient(eosio::name catalog_operator,
                     eosio::name client_coopname) {
  require_auth(catalog_operator);

  eosio::check(catalog_operator.value != 0, "catalog_operator must not be empty");
  eosio::check(client_coopname.value != 0, "client_coopname must not be empty");

  clients_index clients(get_self(), catalog_operator.value);
  auto it = clients.find(client_coopname.value);
  eosio::check(it == clients.end(), "client already registered");

  auto now = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());
  clients.emplace(catalog_operator, [&](auto &c) {
    c.client_coopname = client_coopname;
    c.registered_at   = now;
  });
}
