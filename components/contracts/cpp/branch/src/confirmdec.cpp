/**
 * @brief Подтверждение решения советом — создание кооперативного участка.
 * Callback совета: по утверждению учреждается кооперативный участок с реквизитами
 * из решения (аккаунт участка, избранный председатель), после чего запись решения
 * стирается (история — в журнале действий).
 * @param coopname Наименование кооператива
 * @param hash Якорь процесса
 * @param authorization Документ решения совета
 * @ingroup public_actions
 * @ingroup public_branch_actions

 * @note Авторизация требуется от аккаунта: @p soviet
 */
[[eosio::action]] void branch::confirmdec(eosio::name coopname, eosio::checksum256 hash, document2 authorization) {
  require_auth(_soviet);

  auto dec = get_decision_or_fail(coopname, hash);
  eosio::check(dec.type == "createbranch"_n, "Решение не относится к созданию участка");
  eosio::check(dec.status == "onapproval"_n, "Решение не находится на утверждении совета");

  auto coop = get_cooperative_or_fail(coopname);

  auto authorizer_account = get_account_or_fail(dec.chairman);
  eosio::check(authorizer_account.type == "individual"_n, "Только физическое лицо может быть назначено председателем кооперативного участка");

  // Создаём кооперативный участок с избранным председателем
  branch_index branches(_branch, coopname.value);
  branches.emplace(coopname, [&](auto &row) {
    row.braname = dec.braname;
    row.trustee = dec.chairman;
  });

  action(
    permission_level{_branch, "active"_n},
    _registrator,
    "createbranch"_n,
    std::make_tuple(coopname, dec.braname))
    .send();

  uint64_t branch_count = add_branch_count(coopname);

  if (!coop.is_branched && branch_count >= 3) {  // переход на режим кооперативных участков
    action(
      permission_level{_branch, "active"_n},
      _registrator,
      "enabranches"_n,
      std::make_tuple(coopname))
      .send();
  }

  // Решение исполнено — стираем запись и вопросы повестки (история в журнале действий)
  decision_index decisions(_branch, coopname.value);
  auto itr = decisions.find(dec.id);
  erase_coodecquests(coopname, dec.id);
  decisions.erase(itr);
}
