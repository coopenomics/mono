/**
 * \brief Отозвать релиз (CVE / нарушение / юридический отзыв).
 * \ingroup public_apps_actions
 *
 * Семантика отзыва:
 *  - Релиз становится `withdrawn` и НЕ может быть установлен через CA-auth.
 *  - Запись остаётся в таблице — TTL на withdrawn не действует.
 *  - Если withdrawn-релиз был active со scope=all, `last_active_version`
 *    обнуляется ("") — UI должен показать «нет активной версии», пока
 *    оператор не выпустит новый setrelease или не реактивирует старую.
 *  - Если был active со scope=subnet/canary, `last_active_version` не
 *    трогается — она показывает версию для основной массы кооперативов.
 *
 * \note Авторизация: @p coopname @ active.
 */
void apps::withdraw(eosio::name coopname,
                    eosio::name package_id,
                    std::string version,
                    std::string reason) {
  require_auth(coopname);

  eosio::check(reason.size() <= 512, "reason слишком длинный (макс 512)");

  packages_index packages(_apps, _apps.value);
  auto pkg_it = packages.find(package_id.value);
  eosio::check(pkg_it != packages.end(), "Пакет не зарегистрирован");

  releases_index releases(_apps, _apps.value);
  auto by_pkg = releases.get_index<"bypackage"_n>();

  auto target = by_pkg.end();
  for (auto rit = by_pkg.lower_bound(package_id.value);
       rit != by_pkg.end() && rit->package_id == package_id;
       ++rit) {
    if (rit->version == version) {
      target = rit;
      break;
    }
  }
  eosio::check(target != by_pkg.end(), "Релиз не найден");
  eosio::check(target->status != "withdrawn"_n, "Релиз уже отозван");

  bool was_active_all = target->status == "active"_n
                        && target->scope.kind == "all"_n;
  auto now_tps = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());

  by_pkg.modify(target, coopname, [&](auto &r) {
    r.status = "withdrawn"_n;
    // superseded_at оставляем как есть; meta обогащаем reason'ом.
    if (!reason.empty()) {
      if (!r.meta.empty()) r.meta += "\n";
      r.meta += "withdraw_reason: " + reason;
    }
  });

  if (was_active_all) {
    packages.modify(pkg_it, coopname, [&](auto &p) {
      p.last_active_version = "";
      p.updated_at          = now_tps;
    });
  }
}
