/**
 * @brief Подача заявки на приём доверенным лицом кооперативного участка.
 * Пайщик прикладывает подписанные заявление и договор о полной материальной
 * ответственности. Заявка ожидает одобрения председателя участка.
 * @param coopname Наименование кооператива
 * @param braname Кооперативный участок
 * @param username Заявитель
 * @param hash Внешний идентификатор заявки
 * @param application Подписанный заявителем договор о полной материальной ответственности
 * @param authority Подписанная заявителем доверенность доверенному лицу/оператору участка
 * @ingroup public_actions
 * @ingroup public_branch_actions

 * @note Авторизация требуется от аккаунта: @p coopname
 */
[[eosio::action]] void branch::reqtrusted(eosio::name coopname, eosio::name braname, eosio::name username, eosio::checksum256 hash, document2 application, document2 authority) {
  check_auth_or_fail(_branch, coopname, coopname, "reqtrusted"_n);

  verify_document_or_fail(application);
  verify_document_or_fail(authority);

  get_participant_or_fail(coopname, username);

  auto br = get_branch_or_fail(coopname, braname);
  eosio::check(br.trustee != username, "Председатель участка не может быть доверенным лицом");
  eosio::check(!br.is_account_in_trusted(username), "Пайщик уже является доверенным лицом участка");
  eosio::check(br.trusted.size() < 3, "Достигнут предел доверенных лиц участка (не более трёх)");

  trustreq_index trustreqs(_branch, coopname.value);
  auto idx = trustreqs.get_index<"byhash"_n>();
  eosio::check(idx.find(hash) == idx.end(), "Заявка с указанным идентификатором уже существует");

  trustreqs.emplace(coopname, [&](auto &r) {
    r.id = get_global_id_in_scope(_branch, coopname, "trustreqs"_n);
    r.hash = hash;
    r.coopname = coopname;
    r.braname = braname;
    r.username = username;
    r.application = application;
    r.authority = authority;
  });
}
