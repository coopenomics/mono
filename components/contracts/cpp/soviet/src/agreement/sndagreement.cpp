/**
 * @brief Отправка соглашения участнику
 * Отправляет соглашение участнику кооператива для подписания.
 * Создает новое соглашение или обновляет существующее, привязывая его к целевой программе.
 * @param coopname Наименование кооператива
 * @param administrator Наименование администратора
 * @param username Наименование пользователя, которому отправляется соглашение
 * @param agreement_type Тип соглашения
 * @param document Документ соглашения для подписания
 * @ingroup public_actions
 * @ingroup public_soviet_actions

 * @note Авторизация требуется от аккаунта: @p username или @p administrator
 */
[[eosio::action]] void soviet::sndagreement(eosio::name coopname, eosio::name administrator, eosio::name username, eosio::name agreement_type, document2 document) {
  
  eosio::check(has_auth(username) || has_auth(administrator), "Недостаточно прав доступа");
  
  auto coop = get_cooperative_or_fail(coopname);
    
  if (has_auth(administrator)) {
    check_auth_or_fail(_soviet, coopname, administrator, "sndagreement"_n);
  }
  
  verify_document_or_fail(document);
  
  auto coagreement = get_coagreement_or_fail(coopname, agreement_type);

  // После Эпика 2 (компонент 48): программные соглашения (program_id > 0)
  // переезжают в контракт wallet (wallet::signagree). soviet остаётся owner-ом
  // только не-программных соглашений (program_id == 0).
  eosio::check(coagreement.program_id == 0,
               "soviet::sndagreement: программные соглашения (program_id > 0) подписываются через wallet::signagree");

  uint64_t version = 0;
  
  if (coagreement.draft_id > 0) {
    // Получаем шаблон документа, если draft_id > 0
    auto draft = get_scoped_draft_by_registry_or_fail(_draft, coagreement.draft_id);
    version = draft.version;
  }

  auto agreement_id = get_global_id_in_scope(_soviet, coopname, "agreements"_n);
  
  if (coagreement.program_id > 0) {
    
    auto program = get_program_or_fail(coopname, coagreement.program_id);  
    eosio::check(program.draft_id == coagreement.draft_id || coagreement.draft_id == 0, "Указан неверный идентификатор шаблона целевой программы");
    
    progwallets_index progwallets(_soviet, coopname.value);
    auto wallets_by_username_and_program = progwallets.template get_index<"byuserprog"_n>();
    auto username_and_program_index = combine_ids(username.value, coagreement.program_id);
    auto wallet = wallets_by_username_and_program.find(username_and_program_index);
  
    if (wallet == wallets_by_username_and_program.end()) {
      
      progwallets.emplace(_soviet, [&](auto &b) {
        b.id = progwallets.available_primary_key();
        b.program_id = coagreement.program_id;
        b.coopname = coopname;
        b.username = username;
        b.available = asset(0, coop.initial.symbol);      
        b.agreement_id = agreement_id;
        b.blocked = asset(0, coop.initial.symbol);
        b.membership_contribution = asset(0, coop.initial.symbol);
      });      
    } 
  } 
  
  agreements2_index agreements(_soviet, coopname.value);
  auto agreements_by_username_and_draft = agreements.template get_index<"byuserdraft"_n>();
  auto index = combine_ids(username.value, coagreement.draft_id);

  auto agreement = agreements_by_username_and_draft.find(index);

  if (agreement == agreements_by_username_and_draft.end()) {
    
    agreements.emplace(_soviet, [&](auto &row){
      row.id = agreement_id;
      row.coopname = coopname;
      row.status = ""_n;
      row.type = agreement_type;
      row.version = version;
      row.draft_id = coagreement.draft_id;
      row.program_id = coagreement.program_id;
      row.username = username;
      row.document = document;
      row.updated_at = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());
    });    
  } else {
    
    eosio::check(agreement->status != "confirmed"_n, "Соглашение уже принято");
    
    agreements_by_username_and_draft.modify(agreement, _soviet, [&](auto &row){
      row.status = ""_n;
      row.program_id = coagreement.program_id;
      row.version = version;
      row.document = document;
      row.updated_at = eosio::time_point_sec(eosio::current_time_point().sec_since_epoch());
    });
  }

  // Фиксируем документ в реестре как принятый
  Soviet::make_complete_document(_soviet, coopname, username, Names::SovietActions::SEND_AGREEMENT, document.hash, document);

  Action::send<newagreement_interface>(
    _soviet,
    "newagreement"_n,
    _soviet,
    coopname,
    username,
    agreement_type,
    document
  );

}

