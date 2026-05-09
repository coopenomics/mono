/**
 * @brief Регистрация пайщика в контракте и получение договора УХД от него
 * Создает нового пайщика в системе кооператива с указанными параметрами:
 * - Проверяет уникальность пайщика по имени и хешу
 * - Валидирует договор УХД (если не внешний)
 * - Создает запись пайщика с указанной почасовой ставкой
 * - Отправляет договор на одобрение председателю
 * @param coopname Наименование кооператива
 * @param username Наименование пользователя-пайщика
 * @param contributor_hash Хеш пайщика для идентификации
 * @param rate_per_hour Почасовая ставка пайщика
 * @param is_external_contract Флаг внешнего договора
 * @param contract Договор УХД пайщика
 * @param storage_agreement Договор хранения Имущества
 * @param blagorost_agreement Соглашение о присоединении к целевой потребительской программе "Благорост" (опционально)
 * @ingroup public_actions
 * @ingroup public_capital_actions

 * @note Авторизация требуется от аккаунта: @p coopname
 */
void capital::regcontrib(eosio::name coopname, eosio::name username, checksum256 contributor_hash, eosio::asset rate_per_hour, uint64_t hours_per_day, bool is_external_contract, document2 storage_agreement, std::optional<document2> contract, std::optional<document2> blagorost_agreement, std::optional<document2> generator_agreement) {
  require_auth(coopname);
  
  // если договор не внешний, то проверяем его на корректность
  document2 contract_for_send = document2();
  if (!is_external_contract) {
    eosio::check(contract.has_value(), "Договор УХД пайщика не предоставлен");
    contract_for_send = contract.value();
    // проверяем, что договор подписан пайщиком
    verify_document_or_fail(contract_for_send, {username});
  }

  verify_document_or_fail(storage_agreement, {username});

  // Programный optional-документ считаем «приложенным» только если есть значение
  // и непустой хэш. Пустой/отсутствующий → пропускаем (verify+signagree не шлём).
  const bool has_blagorost_agreement =
      blagorost_agreement.has_value() && !is_empty_document(blagorost_agreement.value());
  const bool has_generator_agreement =
      generator_agreement.has_value() && !is_empty_document(generator_agreement.value());

  if (has_blagorost_agreement) {
    verify_document_or_fail(blagorost_agreement.value(), {username});
  }
  if (has_generator_agreement) {
    verify_document_or_fail(generator_agreement.value(), {username});
  }
  
  Wallet::validate_asset(rate_per_hour);
  eosio::check(hours_per_day >= 0, "Количество часов в день должно быть неотрицательным");
  eosio::check(rate_per_hour.amount >= 0, "Ставка за час должна быть неотрицательной");
  eosio::check(rate_per_hour.amount <= 30000000, "Ставка за час должна быть не более 30000000");
  eosio::check(hours_per_day <= 12, "Количество часов в день должно быть не более 12");

  auto exist_by_username = Capital::Contributors::get_contributor(coopname, username);

  // Проверяем, что пайщик уже подписал соглашение Благорост в wallet::users.programs[]
  // (ADR-008). Подпись делается ДО regcontrib — отдельным action wallet::signagree
  // от coopname@active (например, в bundle reguser → completeincome → signagree).
  // Здесь только gate: либо запись уже есть, либо desktop передал свежий документ
  // (его подпись ставится ОТДЕЛЬНОЙ tx до regcontrib; здесь мы её не процессим,
  // потому что capital@eosio.code не имеет coopname@active для wallet::signagree).
  const auto blagorost_program_id = get_program_id(_capital_program);
  bool blagorost_signed = false;
  {
    Wallet::users_index wallet_users(_wallet, coopname.value);
    auto user_it = wallet_users.find(username.value);
    if (user_it != wallet_users.end()) {
      for (const auto& pa : user_it->programs) {
        if (pa.program_id == blagorost_program_id) { blagorost_signed = true; break; }
      }
    }
  }
  if (!blagorost_signed && !has_blagorost_agreement) {
    eosio::check(false,
      "У пайщика не подписано соглашение программы Благорост (wallet::users.programs[]) "
      "и не предоставлен новый документ. Подпишите wallet::signagree отдельной транзакцией "
      "до regcontrib.");
  }

  // Обработка в зависимости от наличия существующего участника
  if (exist_by_username.has_value()) {
    // Участник уже существует - проверяем его статус
    auto existing = exist_by_username.value();
    
    if (existing.status == Capital::Contributors::Status::IMPORT) {
      // Импортированный участник - завершаем регистрацию обновлением
      eosio::check(existing.contributor_hash == contributor_hash, "Хэш участника не совпадает с импортированным");
      Capital::Contributors::complete_imported_contributor_registration(coopname, existing.id, rate_per_hour, hours_per_day, is_external_contract, contract_for_send);
    } else {
      // Участник с другим статусом - уже зарегистрирован
      eosio::check(false, "Пайщик уже обладает подписанным договором УХД");
    }
  } else {
    // Участник не существует - создаем нового
    auto exist_by_hash = Capital::Contributors::get_contributor_by_hash(coopname, contributor_hash);
    eosio::check(!exist_by_hash.has_value(), "Контрибьютор с данным хэшем уже зарегистрирован");
    
    Capital::Contributors::create_contributor(coopname, username, contributor_hash, is_external_contract, contract_for_send, rate_per_hour, hours_per_day);
  }

  // Открываем кошельки для пайщика если необходимо
  if (!has_program_wallet(coopname, username, _source_program)) {
    Action::send<openprogwall_interface>(
      _soviet,
      Names::External::OPEN_PROGRAM_WALLET,
      _capital,
      coopname,
      username,
      _source_program,
      uint64_t(0)
    );
  }

  if (!has_program_wallet(coopname, username, _capital_program)) {
    Action::send<openprogwall_interface>(
      _soviet,
      Names::External::OPEN_PROGRAM_WALLET,
      _capital,
      coopname,
      username,
      _capital_program,
      uint64_t(0)
    );
  }

  std::string memo = "";

  if (is_external_contract) {
    memo += Capital::Memo::get_external_contract_memo();
  } else {
    // Фиксируем документ в реестре как принятый
    Soviet::make_complete_document(_capital, coopname, username, Names::Capital::REGISTER_CONTRIBUTOR, contract_for_send.hash, contract_for_send);
  }
  
  //отправить на approve председателю
  ::Soviet::create_approval(
    _capital,
    coopname,
    username,
    contract_for_send,
    Names::Capital::REGISTER_CONTRIBUTOR,
    contributor_hash,
    _capital,
    Names::Capital::APPROVE_CONTRIBUTOR,
    Names::Capital::DECLINE_CONTRIBUTOR,
    memo
  );

  // Линковка дополнительных документов
  Action::send<newlink_interface>(
    _soviet,
    "newlink"_n,
    _capital,
    coopname,
    username,
    Names::Capital::REGISTER_CONTRIBUTOR,
    contributor_hash,
    storage_agreement
  );
  
  // Фиксируем документ в реестре как принятый
  Soviet::make_complete_document(_capital, coopname, username, Names::Capital::REGISTER_CONTRIBUTOR, storage_agreement.hash, storage_agreement);


  // Программные соглашения (Благорост / Генератор): inline-вызов wallet::signagree
  // от _capital@active (capital@eosio.code обладает им автоматически).
  // wallet::signagree принимает auth от системных контрактов из contracts_whitelist
  // — это сохраняет атомарность связки «документ из payload regcontrib → запись в
  // wallet::users.programs[] → фиксация в реестре документов»: всё происходит в
  // одной транзакции на одних и тех же данных, разойтись не может.
  // wallet::signagree сам делает make_complete_document внутри.
  if (has_blagorost_agreement) {
    const auto blagorost_program = get_program_or_fail(coopname, blagorost_program_id);
    eosio::action(
      eosio::permission_level{_capital, "active"_n},
      _wallet,
      Names::WalletActions::SIGN_AGREEMENT,
      std::make_tuple(coopname, username, blagorost_program_id,
                      blagorost_agreement.value(), blagorost_program.draft_id)
    ).send();
  }

  if (has_generator_agreement) {
    const auto generator_program_id = get_program_id(_source_program);
    const auto generator_program    = get_program_or_fail(coopname, generator_program_id);
    eosio::action(
      eosio::permission_level{_capital, "active"_n},
      _wallet,
      Names::WalletActions::SIGN_AGREEMENT,
      std::make_tuple(coopname, username, generator_program_id,
                      generator_agreement.value(), generator_program.draft_id)
    ).send();
  }
};