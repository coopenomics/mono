/**
 * @brief Предварительная валидация решения совета персоналом
 * Позволяет персоналу подтвердить поступление оплаты или провести другую форму валидации перед принятием советом какого-либо решения.
 * @param coopname Наименование кооператива
 * @param username Наименование члена персонала, проводящего валидацию
 * @param decision_id Идентификатор решения, которое подлежит валидации
 * @ingroup public_actions
 * @ingroup public_soviet_actions

 * @note Авторизация требуется от аккаунта: @p username
 */
void soviet::validate(eosio::name coopname, eosio::name username, uint64_t decision_id) { 
  require_auth(username);

  boards_index boards(_soviet, coopname.value);
  auto board = get_board_by_type_or_fail(coopname, "soviet"_n);
  
  staff_index staff(_soviet, coopname.value);
  auto persona = staff.find(username.value);

  eosio::check(persona != staff.end(), "Указанный аккаунт не является сотрудником");
  eosio::check(persona -> has_right(_soviet, "validate"_n), "Недостаточно прав доступа");

  decisions_index decisions(_soviet, coopname.value);
  auto decision = decisions.find(decision_id);
  eosio::check(decision != decisions.end(), "Документ не найден");
  
  // Проверяем был ли совершен регистрационный взнос
  if (decision -> type == "joincoop"_n) {
    
    joincoops_index joincoops(_soviet, coopname.value);
    auto joincoop = joincoops.find(decision -> batch_id);
    eosio::check(joincoop != joincoops.end(), "Данные пользователя не найдены");
    
    eosio::check(joincoop -> is_paid == true, "Регистрационный взнос не оплачен");
  };
  
  bool validated = !decision -> validated;
  decisions.modify(decision, RamPayer::of(decisions, coopname), [&](auto &d){
    d.validated = validated;
  });

  autosigner_index autosigner(_soviet, coopname.value);  
  auto signer = autosigner.find(decision -> id);

  if (validated && signer == autosigner.end())
    autosigner.emplace(RamPayer::of(autosigner, coopname), [&](auto &o) {
      o.decision_id = decision -> id;
    });
}