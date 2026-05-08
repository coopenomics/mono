/**
 * @brief Подписание программного соглашения пайщиком (ADR-008).
 *
 * Wallet — owner программных соглашений (Эпик 2 компонента 48). Запись хранит
 * только хэш и метаданные документа; полный текст лежит в action data
 * (audit trail) и в off-chain реестре документов — НЕ в state контракта.
 *
 * Upsert по `(username, program_id)`:
 *   - если у `username` нет записи в `users` — emplace новой записью с одной
 *     программой в `programs[]`;
 *   - если запись есть, но `program_id` ещё не подписан — push в `programs[]`;
 *   - если `program_id` уже подписан — update version/draft_id/signed_at/doc_hash
 *     (повторная подпись = пересоглашение).
 *
 * @param coopname Кооператив (payer для записи `users`)
 * @param username Пайщик, подписывающий соглашение
 * @param program_id Идентификатор программы (см. soviet::programs)
 * @param document Документ соглашения с подписями (только в action data, не в state)
 * @param draft_id Идентификатор шаблона документа (см. draft::drafts)
 * @ingroup public_actions
 * @ingroup public_wallet_actions
 *
 * @note Авторизация: @p coopname (active) ИЛИ один из системных контрактов
 *       из `contracts_whitelist` (например, `capital@active` для inline-вызова
 *       из `capital::regcontrib`). В обоих случаях кооператив остаётся payer-ом
 *       записи `wallet::users`. Whitelist гарантирует атомарность связки
 *       «документ из payload → wallet::users.programs[] → реестр»: контракт не
 *       может разойтись, поскольку выполняет signagree в той же транзакции на
 *       тех же данных.
 */
[[eosio::action]] void wallet::signagree(
  eosio::name coopname,
  eosio::name username,
  uint64_t    program_id,
  document2   document,
  uint64_t    draft_id
) {
  // Auth: либо сам кооператив, либо системный контракт из whitelist (например
  // capital — inline вызов из regcontrib). require_auth(coopname) тоже валиден
  // через ветку has_auth(coopname). Если ничего не подходит — payer-helper
  // упадёт «Недостаточно прав доступа».
  // Payer для записи `wallet::users` — тот, кто подал auth: сам кооператив
  // (когда signagree вызвал desktop напрямую) ИЛИ системный контракт
  // (capital@active inline). RAM-аккаунтинг не может увеличить usage аккаунту,
  // не подавшему auth — поэтому нельзя жёстко платить coopname'ом.
  std::vector<eosio::name> allowed{coopname};
  for (const auto& c : contracts_whitelist) allowed.push_back(c);
  const eosio::name payer = check_auth_and_get_payer_or_fail(allowed);

  // Кооператив должен существовать и быть активным.
  get_cooperative_or_fail(coopname);

  // Симметрично soviet::sndagreement: проверки participant нет — кооператив
  // подписывает action своим ключом и отвечает за корректность; на этапе
  // bundle-регистрации (createaccount + reguser + completeincome + signagree)
  // participant ещё не создан (создаётся позже в soviet::confirmreg →
  // soviet::addpartcpnt после голосования совета). Доверие — на coopname@active.

  // Программа должна существовать и быть активной.
  auto program = get_program_or_fail(coopname, program_id);

  // Документ должен иметь хотя бы одну валидную подпись.
  verify_document_or_fail(document);

  // Если у программы задан draft_id — действующая подпись должна быть на тот же draft.
  if (program.draft_id > 0) {
    eosio::check(draft_id == program.draft_id,
                 "draft_id соглашения не совпадает с draft_id программы");
  }

  // Получаем версию шаблона из реестра drafts (если draft_id задан).
  uint16_t version = 0;
  if (draft_id > 0) {
    auto draft = get_scoped_draft_by_registry_or_fail(_draft, draft_id);
    version = static_cast<uint16_t>(draft.version);
  }

  Wallet::users_index users(_wallet, coopname.value);
  auto user_it = users.find(username.value);

  Wallet::program_agreement new_pa{
    .program_id = program_id,
    .doc_hash   = document.hash,
    .version    = version,
    .draft_id   = draft_id,
    .signed_at  = eosio::current_time_point(),
  };

  if (user_it == users.end()) {
    users.emplace(payer, [&](auto &row) {
      row.username = username;
      row.programs = { new_pa };
    });
  } else {
    users.modify(user_it, payer, [&](auto &row) {
      auto pa_it = std::find_if(
        row.programs.begin(), row.programs.end(),
        [&](const Wallet::program_agreement &p) { return p.program_id == program_id; });

      if (pa_it == row.programs.end()) {
        row.programs.push_back(new_pa);
      } else {
        *pa_it = new_pa;
      }
    });
  }

  // Фиксируем документ в реестре документов как принятый — симметрично
  // soviet::sndagreement, чтобы программные соглашения попадали в общий
  // off-chain реестр документов кооператива.
  Soviet::make_complete_document(_wallet, coopname, username,
                                 Names::WalletActions::SIGN_AGREEMENT,
                                 document.hash, document);
}
