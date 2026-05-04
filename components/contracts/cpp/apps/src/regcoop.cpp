/**
 * \brief Регистрация кооператива в каталоге.
 * \ingroup public_apps_actions
 *
 * Кооператив сам подписывает транзакцию своим `@active`-ключом и
 * передаёт публичную часть `signing_key` (отдельный ключ для подписи
 * signed-request'ов от DC-оркестратора в `CA-auth`).
 *
 * Идемпотентность: если такой `coopname` уже зарегистрирован — фейл.
 * Для обновления полей — `setcoop`.
 *
 * \note Контекст: этот action — часть процесса подключения кооператива
 *       к каталогу приложений на Восходе (вне scope текущего MVP
 *       apps-catalog). Реальный flow: кабинет ВОСХОД проводит
 *       onboarding, генерирует/принимает signing keypair, подписывает
 *       и отправляет эту транзакцию.
 *
 * \note Авторизация: @p coopname @ active.
 */
void apps::regcoop(eosio::name coopname,
                   eosio::checksum256 chain_id,
                   eosio::name subnet_label,
                   eosio::public_key signing_key) {
  require_auth(coopname);

  eosio::check(subnet_label.value != 0, "subnet_label обязателен");

  coops_index coops(_apps, _apps.value);
  auto it = coops.find(coopname.value);
  eosio::check(it == coops.end(), "Кооператив уже зарегистрирован — используйте setcoop");

  auto now_tps = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());
  coops.emplace(coopname, [&](auto &c) {
    c.coopname       = coopname;
    c.chain_id       = chain_id;
    c.subnet_label   = subnet_label;
    c.signing_key    = signing_key;
    c.active         = true;
    c.registered_at  = now_tps;
    c.key_rotated_at = now_tps;
  });
}
