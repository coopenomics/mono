/**
 * @brief Миграция данных контракта.
 * Разовая нормализация типа аккаунта в registrator::accounts
 * @ingroup public_actions
 * @ingroup public_registrator_actions

 * @note Авторизация требуется от аккаунта: @p registrator
 */
[[eosio::action]] void registrator::migrate() {
  require_auth(_registrator);

  // ──────────────────────────────────────────────────────────────────────────
  // Разовая нормализация account.type (инцидент 2026-08-10).
  //
  // Причина: аккаунты первичного бутстрапа цепи (registrator == eosio) осели в
  // registrator::accounts с типом "user"_n — значением, которое ни reguser, ни
  // adduser не допускают (там разрешены только individual/entrepreneur/
  // organization). Пока такой тип не нормализован, аккаунт не проходит проверки
  // вида `account.type == "individual"_n` — createbranch/editbranch/addtrusted/
  // confirmdec (branch) и createboard/updateboard (soviet), то есть аккаунт
  // нельзя назначить председателем кооперативного участка или членом совета.
  // На testnet под это попал ровно один аккаунт — `ant` (первый аккаунт цепи,
  // registered_at 2024-10-01, registrator=eosio); на проде таких нет.
  //
  // Источник истины — soviet::participants: там у того же пайщика тип проставлен
  // корректно (у `ant` в scope voskhod — individual). Берём тип оттуда, перебирая
  // кооперативы из acc.storages; если членства нет ни в одном (или тип у пайщика
  // не заполнен — binary_extension), падаем на "individual"_n: аккаунты
  // организаций заводятся только через regcoop/createbranch и всегда несут
  // корректный "organization"_n, поэтому невалидный тип означает физлицо.
  //
  // Идемпотентно: повторный прогон не находит невалидных типов → no-op.
  accounts_index accounts(_registrator, _registrator.value);

  for (auto acc = accounts.begin(); acc != accounts.end(); ++acc) {
    if (acc->type == "individual"_n || acc->type == "entrepreneur"_n || acc->type == "organization"_n)
      continue;

    eosio::name resolved = "individual"_n;

    for (const auto &coopname : acc->storages) {
      participants_index participants(_soviet, coopname.value);
      auto part = participants.find(acc->username.value);
      if (part == participants.end() || !part->type.has_value())
        continue;

      eosio::name part_type = part->type.value();
      if (part_type == "individual"_n || part_type == "entrepreneur"_n || part_type == "organization"_n) {
        resolved = part_type;
        break;
      }
    }

    accounts.modify(acc, eosio::same_payer, [&](auto &row) { row.type = resolved; });
  }
}
