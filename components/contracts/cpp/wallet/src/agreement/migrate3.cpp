/**
 * @brief Идемпотентная миграция программного соглашения из soviet::agreements3.
 *
 * Per-record self-service миграция: для каждой записи `agreements3` с
 * `program_id > 0` и `status = "confirmed"` — append/update в `wallet::users`.
 *
 * Идемпотентность: повторный вызов с теми же параметрами = update до того же
 * значения, без бух-эффектов. `migration_state.json` не используется
 * (объёмы 20–30 пайщиков; ADR-006).
 *
 * Без проверок программы/пайщика/документа: миграция доверяет источнику
 * (soviet::agreements3) и заполняет state как есть. Полные проверки делает
 * нормальный flow `signagree`.
 *
 * @param coopname Кооператив (auth: coopname@active, payer)
 * @param username Пайщик
 * @param program_id Идентификатор программы
 * @param doc_hash Хэш документа из `agreements3.document.hash`
 * @param version Версия шаблона
 * @param draft_id Идентификатор шаблона документа
 * @param signed_at Момент подписания (берётся из `agreements3.updated_at`)
 * @ingroup public_actions
 * @ingroup public_wallet_actions
 *
 * @note Авторизация требуется от аккаунта: @p coopname (active)
 */
[[eosio::action]] void wallet::migrate3(
  eosio::name        coopname,
  eosio::name        username,
  uint64_t           program_id,
  eosio::checksum256 doc_hash,
  uint16_t           version,
  uint64_t           draft_id,
  eosio::time_point  signed_at
) {
  require_auth(coopname);

  Wallet::users_index users(_wallet, coopname.value);
  auto user_it = users.find(username.value);

  Wallet::program_agreement pa{
    .program_id = program_id,
    .doc_hash   = doc_hash,
    .version    = version,
    .draft_id   = draft_id,
    .signed_at  = signed_at,
  };

  if (user_it == users.end()) {
    users.emplace(coopname, [&](auto &row) {
      row.username = username;
      row.programs = { pa };
    });
  } else {
    users.modify(user_it, coopname, [&](auto &row) {
      auto it = std::find_if(
        row.programs.begin(), row.programs.end(),
        [&](const Wallet::program_agreement &p) { return p.program_id == program_id; });
      if (it == row.programs.end()) {
        row.programs.push_back(pa);
      } else {
        *it = pa;
      }
    });
  }
}
