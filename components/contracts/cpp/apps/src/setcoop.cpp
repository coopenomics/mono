/**
 * \brief Обновление параметров кооператива.
 * \ingroup public_apps_actions
 *
 * Все параметры опциональны — обновляются только переданные. Сценарии
 * использования:
 *  - Ротация подписи: `setcoop(coopname, signing_key=<new>)`. Меняет
 *    `signing_key` и `key_rotated_at=now`.
 *  - Деактивация: `setcoop(coopname, active=false)`. CA-auth перестанет
 *    отвечать на запросы от этого коопа.
 *  - Миграция между подсетями: `setcoop(coopname, chain_id=<new>, subnet_label=<new>)`.
 *  - Обновление human-label: `setcoop(coopname, subnet_label=<new>)`.
 *
 * \note Ранее выпущенные JWT (TTL 14 дней в CA-auth) остаются валидны
 *       после ротации `signing_key`. Только новые signed-request'ы должны
 *       идти от нового приват-ключа. Это даёт zero-downtime ротации.
 *
 * \note Авторизация: @p coopname @ active. Если `@active`-ключ
 *       коопаккаунта скомпрометирован, эта операция не доступна злоумышленнику —
 *       сначала кооператив должен ротировать `@active` через
 *       `eosio::updateauth` (это отдельная операция, владелец-ключ).
 */
void apps::setcoop(eosio::name coopname,
                   std::optional<eosio::checksum256> chain_id,
                   std::optional<eosio::name> subnet_label,
                   std::optional<eosio::public_key> signing_key,
                   std::optional<bool> active) {
  require_auth(coopname);

  coops_index coops(_apps, _apps.value);
  auto it = coops.find(coopname.value);
  eosio::check(it != coops.end(), "Кооператив не зарегистрирован — используйте regcoop");

  bool nothing_to_change = !chain_id.has_value()
                            && !subnet_label.has_value()
                            && !signing_key.has_value()
                            && !active.has_value();
  eosio::check(!nothing_to_change, "Нет полей для обновления");

  auto now_tps = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());
  coops.modify(it, coopname, [&](auto &c) {
    if (chain_id.has_value())     c.chain_id     = *chain_id;
    if (subnet_label.has_value()) {
      eosio::check(subnet_label->value != 0, "subnet_label не может быть пустым");
      c.subnet_label = *subnet_label;
    }
    if (signing_key.has_value()) {
      c.signing_key    = *signing_key;
      c.key_rotated_at = now_tps;
    }
    if (active.has_value())       c.active       = *active;
  });
}
