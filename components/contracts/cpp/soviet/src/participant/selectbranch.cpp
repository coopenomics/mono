/**
 * @brief Выбор филиала участником
 * Позволяет участнику выбрать филиал кооператива для привязки.
 * Отправляет уведомления о выборе филиала в систему документооборота.
 * @param coopname Наименование кооператива
 * @param username Наименование участника
 * @param braname Наименование выбранного филиала
 * @param document Документ с подтверждением выбора филиала
 * @ingroup public_actions
 * @ingroup public_soviet_actions

 * @note Авторизация требуется от аккаунта: @p coopname
 */
[[eosio::action]] void soviet::selectbranch(eosio::name coopname, eosio::name username, eosio::name braname, document2 document){
  require_auth(coopname);
  
  verify_document_or_fail(document);
  get_branch_or_fail(coopname, braname);

  // председатель кооперативного участка привязан к собственному участку
  // и не может сменить его, пока исполняет обязанности
  branch_index branches(_branch, coopname.value);
  auto branches_by_trustee = branches.get_index<"bytrustee"_n>();
  eosio::check(branches_by_trustee.find(username.value) == branches_by_trustee.end(),
               "Председатель кооперативного участка не может сменить участок, пока исполняет обязанности председателя");

  participants_index participants(_soviet, coopname.value);
  auto participant = participants.find(username.value);
  eosio::check(participant != participants.end(), "Пайщик не найден");
  
  participants.modify(participant, coopname, [&](auto &row){
    row.braname = braname;
  });
    
  // отправляем документ во входящий реестр
  checksum256 hash = document.hash;
  
  Action::send<newsubmitted_interface>(
    _soviet,
    "newsubmitted"_n,
    _soviet,
    coopname,
    username,
    "selectbranch"_n,
    hash,
    document
  );
  
  // отправляем документ в принятый реестр
  Action::send<newresolved_interface>(
    _soviet,
    "newresolved"_n,
    _soviet,
    coopname,
    username,
    "selectbranch"_n,
    hash,
    document
  );
}