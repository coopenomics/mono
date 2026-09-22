/**
 * @brief Приём заявления об аннулировании соглашений ЦПП к заявлению на выход.
 * Пайщик выходит из кооператива и тем же заявлением прекращает участие в
 * целевых потребительских программах (registry 190). Документ приходит
 * отдельным действием в одной транзакции с exitcoop: сигнатура exitcoop
 * остаётся прежней, а совет видит оба заявления.
 * @param coopname Наименование кооператива
 * @param username Имя пайщика, выходящего из кооператива
 * @param exit_hash Хэш процесса выхода
 * @param annulment Подписанное заявление об аннулировании соглашений (registry 190)
 * @ingroup public_actions
 * @ingroup public_registrator_actions

 * @note Авторизация требуется от аккаунта: @p coopname
 */
void registrator::exitagree(eosio::name coopname, eosio::name username, checksum256 exit_hash, document2 annulment) {
  require_auth(coopname);

  get_cooperative_or_fail(coopname);

  Registrator::exits_index exits(_registrator, coopname.value);
  auto e = exits.find(username.value);
  eosio::check(e != exits.end(), "Заявление на выход не подано");
  eosio::check(e->exit_hash == exit_hash, "Хэш процесса выхода не совпадает");
  eosio::check(e->status == "pending"_n, "Соглашения аннулируются до решения совета");
  eosio::check(!e->annulment_statement.has_value(),
               "Заявление об аннулировании соглашений уже подано");

  // Подпись пайщика под заявлением — его ключом: транзакцию шлёт кооператив.
  verify_document_or_fail(annulment);
  verify_signer_keys_or_fail(annulment, username);

  exits.modify(e, RamPayer::of(exits, coopname), [&](auto &row) {
    row.annulment_statement = annulment;
  });

  // Документ попадает в реестр — совет и пайщик видят его наравне с заявлением
  // о выходе, а аннулирование соглашений опирается на подписанное основание.
  Soviet::make_complete_document(_registrator, coopname, username, "exitagree"_n, exit_hash, annulment);
}
