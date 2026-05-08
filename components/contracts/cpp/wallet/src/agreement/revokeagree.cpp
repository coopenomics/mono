/**
 * @brief Расторжение программного соглашения пайщика.
 *
 * Удаляет программу из `users[username].programs[]`. Если в результате vector
 * пустеет — удаляет запись `users` целиком (RAM освобождается).
 *
 * @param coopname Кооператив (auth: coopname@active)
 * @param username Пайщик, расторгающий соглашение
 * @param program_id Идентификатор программы
 * @ingroup public_actions
 * @ingroup public_wallet_actions
 *
 * @note Авторизация требуется от аккаунта: @p coopname (active)
 */
[[eosio::action]] void wallet::revokeagree(
  eosio::name coopname,
  eosio::name username,
  uint64_t    program_id
) {
  require_auth(coopname);

  Wallet::users_index users(_wallet, coopname.value);
  auto user_it = users.find(username.value);
  eosio::check(user_it != users.end(),
               "У пайщика нет программных соглашений в wallet::users");

  // Ищем индекс программы в vector.
  auto pa_it = std::find_if(
    user_it->programs.begin(), user_it->programs.end(),
    [&](const Wallet::program_agreement &p) { return p.program_id == program_id; });

  eosio::check(pa_it != user_it->programs.end(),
               "Указанная программа не подписана пайщиком");

  if (user_it->programs.size() == 1) {
    // Последняя программа — удаляем запись users целиком.
    users.erase(user_it);
  } else {
    users.modify(user_it, coopname, [&](auto &row) {
      auto it = std::find_if(
        row.programs.begin(), row.programs.end(),
        [&](const Wallet::program_agreement &p) { return p.program_id == program_id; });
      row.programs.erase(it);
    });
  }
}
