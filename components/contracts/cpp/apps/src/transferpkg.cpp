/**
 * \brief Передача владения пакетом другому пользователю (FR3).
 * \ingroup public_apps_actions
 *
 * Меняет `owner` на `new_owner`. Прав на сами релизы это не меняет —
 * `setrelease` всё равно выполняется провайдером каталога (`coopname`),
 * `owner` — это поле для аудита и UI «чей это пакет».
 *
 * \note Авторизация: @p coopname @ active.
 */
void apps::transferpkg(eosio::name coopname,
                       eosio::name package_id,
                       eosio::name new_owner) {
  require_auth(coopname);

  eosio::check(new_owner.value != 0, "new_owner не может быть пустым");

  packages_index packages(_apps, _apps.value);
  auto it = packages.find(package_id.value);
  eosio::check(it != packages.end(), "Пакет не найден");
  eosio::check(it->owner != new_owner, "Пакет уже принадлежит этому владельцу");

  auto now = eosio::current_time_point().sec_since_epoch();
  packages.modify(it, coopname, [&](auto &p) {
    p.owner      = new_owner;
    p.updated_at = eosio::time_point_sec(now);
  });
}
