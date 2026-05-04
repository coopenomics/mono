/**
 * \brief Регистрация нового пакета в каталоге.
 * \ingroup public_apps_actions
 *
 * Контракт операции:
 *  - PK = `package_id`. Если такой уже существует — фейлим («имя занято»).
 *  - `package_name` — внешнее имя; не уникально (теоретически два пакета
 *    могут иметь одинаковое npm-имя, но разные `package_id`; на практике
 *    это ловится UI/правилами кабинета ВОСХОД).
 *  - `compatible_subnets` — может быть пустой; в этом случае пакет
 *    считается совместимым со всеми подсетями (resolver на стороне `CA`
 *    обрабатывает пустой набор как «нет ограничений»).
 *  - `last_active_version` инициализируется пустой строкой; заполнится
 *    первым `setrelease` со scope=all.
 *
 * \note Авторизация: @p coopname @ active.
 */
void apps::regpackage(eosio::name coopname,
                      eosio::name package_id,
                      std::string package_name,
                      eosio::name owner,
                      std::vector<eosio::name> compatible_subnets) {
  require_auth(coopname);

  eosio::check(package_id.value != 0, "package_id не может быть пустым");
  eosio::check(owner.value != 0, "owner не может быть пустым");
  eosio::check(!package_name.empty(), "package_name не может быть пустым");
  eosio::check(package_name.size() <= 256, "package_name слишком длинный (макс 256)");

  packages_index packages(_apps, _apps.value);
  auto it = packages.find(package_id.value);
  eosio::check(it == packages.end(), "Пакет с таким package_id уже зарегистрирован");

  auto now = eosio::current_time_point().sec_since_epoch();
  packages.emplace(coopname, [&](auto &p) {
    p.package_id          = package_id;
    p.package_name        = package_name;
    p.owner               = owner;
    p.compatible_subnets  = compatible_subnets;
    p.last_active_version = "";
    p.created_at          = eosio::time_point_sec(now);
    p.updated_at          = eosio::time_point_sec(now);
  });
}
