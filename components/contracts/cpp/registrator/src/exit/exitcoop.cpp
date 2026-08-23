/**
 * @brief Подача заявления на выход из кооператива.
 * Действующий пайщик подаёт подписанное заявление о выходе (registry 200).
 * Создаётся объект выхода и повестка совета `leavecoop` на рассмотрение.
 * Возврат паевого взноса произойдёт после одобрения советом (confirmexit).
 * @param coopname Наименование кооператива
 * @param username Имя пайщика, выходящего из кооператива
 * @param exit_hash Хэш процесса выхода
 * @param statement Подписанное заявление о выходе (registry 200)
 * @ingroup public_actions
 * @ingroup public_registrator_actions

 * @note Авторизация требуется от аккаунта: @p coopname
 */
void registrator::exitcoop(eosio::name coopname, eosio::name username, checksum256 exit_hash, document2 statement) {
  require_auth(coopname);

  get_cooperative_or_fail(coopname);

  // выйти может только действующий пайщик (не заблокированный)
  get_participant_or_fail(coopname, username);

  // повторная подача запрещена — у пайщика может быть только один процесс выхода
  Registrator::exits_index exits(_registrator, coopname.value);
  auto existing = exits.find(username.value);
  eosio::check(existing == exits.end(), "Заявление на выход уже подано");

  auto by_hash = Registrator::get_exit_by_hash(coopname, exit_hash);
  eosio::check(!by_hash.has_value(), "Объект выхода уже существует с указанным хэшем");

  // проверяем подпись заявления о выходе
  verify_document_or_fail(statement);

  exits.emplace(coopname, [&](auto &e) {
    e.username = username;
    e.coopname = coopname;
    e.status = "pending"_n;
    e.created_at = current_time_point();
    e.statement = statement;
    e.exit_hash = exit_hash;
    e.quantity = asset(0, _root_govern_symbol);
  });

  // повестка совета на рассмотрение выхода с коллбэками confirmexit/declinexit
  ::Soviet::create_agenda(
    _registrator,
    coopname,
    username,
    get_valid_soviet_action("leavecoop"_n),
    exit_hash,
    _registrator,                 // callback_contract
    "confirmexit"_n,              // callback при одобрении
    "declinexit"_n,               // callback при отказе
    statement,
    std::string("")
  );
}
