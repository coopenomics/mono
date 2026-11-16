/// Название счёта 865 до редакции 16.11.2026 — по нему миграция узнаёт строку,
/// которую кооператив не переименовывал сам.
inline constexpr std::string_view MUTUAL_ACCOUNT_NAME_BEFORE_16_11 = "Фонд взаимного обеспечения";

/**
 * @brief Миграция данных контракта
 *
 * Редакция 16.11.2026 (решение владельца): фонд №5 называется «Фонд
 * социально-экономического взаимодействия и социального обеспечения», и счёт
 * 865 плана счетов получает то же название. Название счёта хранится в строке
 * таблицы `accounts` каждого кооператива, поэтому одной правки карты счетов
 * мало: действие обходит кооперативы и переименовывает строку счёта 865, если
 * она есть и носит прежнее название. Остатки счёта не меняются. Идемпотентно:
 * повторный вызов ничего не пишет.
 *
 * Прежняя миграция заводила расчётный счёт суммой паевого фонда и
 * вступительных взносов, если его остаток был ровно нулём. Она отработала на
 * всех кооперативах один раз (сверено по сети 23.09.2026) и снята: на каждом
 * следующем деплое она оставалась риском второго начисления.
 *
 * Границы: по одной строке счёта на кооператив, чтение по первичному ключу.
 *
 * @ingroup public_actions
 * @ingroup public_ledger_actions

 * @note Авторизация требуется от аккаунта: @p ledger
 */
void ledger::migrate(){
  require_auth(_ledger);

  const std::string renamed = Ledger::get_account_name_by_id(Ledger::accounts::MUTUAL_SECURITY_FUND);
  for (const auto& coopname : Core::Registrator::get_cooperative_names()) {
    laccounts_index accounts(_ledger, coopname.value);
    auto account = accounts.find(Ledger::accounts::MUTUAL_SECURITY_FUND);
    if (account == accounts.end() || account->name != MUTUAL_ACCOUNT_NAME_BEFORE_16_11) continue;
    accounts.modify(account, RamPayer::of(accounts, coopname), [&](auto& row) {
      row.name = renamed;
    });
  }
}
