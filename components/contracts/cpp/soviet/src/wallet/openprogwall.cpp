/**
 * @brief Открытие кошелька программы для участника
 * Создает кошелек программы для участника, если он еще не существует.
 * Инициализирует кошелек с нулевыми балансами.
 * @param coopname Наименование кооператива
 * @param username Наименование пользователя
 * @param program_type Тип программы
 * @param agreement_id Идентификатор соглашения (может быть 0)
 * @ingroup public_actions
 * @ingroup public_soviet_actions

 * @note Авторизация требуется от аккаунта в белом списке контрактов
 */
void soviet::openprogwall(name coopname, name username, name program_type, uint64_t agreement_id) {
  name payer = check_auth_and_get_payer_or_fail(contracts_whitelist);

  auto program_id = get_program_id(program_type);

  // Идемпотентность по самой таблице progwallets (легаси-учёт): не плодим
  // дубликаты, если запись уже существует. Проверка по «byuserprog» оставлена
  // здесь локально — фазаут progwallets ещё не завершён, общий помощник в
  // lib/core/programs.hpp переехал на wallet::users (другая семантика).
  progwallets_index progwallets(_soviet, coopname.value);
  auto by_user_program = progwallets.template get_index<"byuserprog"_n>();
  auto wallet_idx_it = by_user_program.find(combine_ids(username.value, program_id));
  if (wallet_idx_it != by_user_program.end()) return;

  if (agreement_id > 0) {
    agreements2_index agreements(_soviet, coopname.value);
    auto agreement = agreements.find(agreement_id);
    check(agreement != agreements.end(), "Соглашение не найдено");
    check(agreement->username == username, "Неверный пользователь соглашения и кошелька");
  }

  //TODO: make payer coopname
  progwallets.emplace(_soviet, [&](auto &b) {
    b.id = progwallets.available_primary_key();
    b.program_id = program_id;
    b.coopname = coopname;
    b.username = username;
    b.agreement_id = agreement_id;
    b.available = asset(0, _root_govern_symbol);
    b.blocked = asset(0, _root_govern_symbol);
    b.membership_contribution = asset(0, _root_govern_symbol);
  });
};