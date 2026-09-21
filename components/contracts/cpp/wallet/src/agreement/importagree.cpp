/**
 * @brief Фиксация программного соглашения, подписанного вне платформы (импорт пайщика).
 *
 * Старых пайщиков кооператив вводит в электронный учёт как есть: договор УХД и
 * соглашение о присоединении к программе подписаны на бумаге задолго до
 * платформы, и электронной подписи пайщика под ними нет и быть не может. При
 * этом `ledger2::walletop` перед любой операцией на USER_SHARED-кошельке
 * требует запись программы в `wallet::users.programs[]` (ADR-004, Story 3.2) —
 * без неё импортированному пайщику нельзя даже зачислить его же взнос.
 *
 * Действие закрывает ровно этот разрыв: заводит запись программы с нулевым
 * `doc_hash` и `draft_id = 0`. Нули и означают «подписано вне платформы» —
 * электронного документа нет, сетевого шаблона под бумагой тоже. Реквизиты
 * бумажного соглашения (номер и дата) кооператив хранит в реестре параметров
 * документов, вне цепи. Дальше импортированный пайщик работает как все:
 * проверка в walletop смотрит на факт наличия программы, а не на документ.
 *
 * Авторизация — только `capital@active`: путь ввода бумажного соглашения
 * открыт единственному сценарию `capital::importcontrib`. Ни кооператив
 * напрямую, ни другие контракты соглашение без подписи завести не могут, и
 * обычный порядок (`wallet::signagree` с подписанным документом) остаётся
 * единственным для всех, кто вступает через платформу.
 *
 * Идемпотентность: программа уже в `programs[]` → выход без изменений.
 * Электронная подпись старше бумаги — импорт её не перетирает.
 *
 * @param coopname Кооператив (scope записи `wallet::users`)
 * @param username Импортируемый пайщик
 * @param program_id Идентификатор программы (см. `soviet::programs`)
 * @ingroup public_actions
 * @ingroup public_wallet_actions
 *
 * @note Авторизация требуется от аккаунта: `capital` (active)
 */
[[eosio::action]] void wallet::importagree(
  eosio::name coopname,
  eosio::name username,
  uint64_t    program_id
) {
  require_auth(_capital);

  // Кооператив должен существовать и быть активным.
  get_cooperative_or_fail(coopname);

  // Программа должна существовать у этого кооператива.
  get_program_or_fail(coopname, program_id);

  // Уже подписано (хоть в платформе, хоть прошлым импортом) — оставляем как есть.
  if (has_signed_program_agreement(coopname, username, program_id)) return;

  Wallet::program_agreement pa{
    .program_id = program_id,
    .doc_hash   = eosio::checksum256(),
    .version    = 0,
    .draft_id   = 0,
    .signed_at  = eosio::current_time_point(),
  };

  // Payer — capital: auth подал он, и RAM-аккаунтинг не может записать расход
  // аккаунту, который транзакцию не авторизовал.
  Wallet::users_index users(_wallet, coopname.value);
  auto user_it = users.find(username.value);

  if (user_it == users.end()) {
    users.emplace(RamPayer::of(users, coopname), [&](auto &row) {
      row.username = username;
      row.programs = { pa };
    });
  } else {
    users.modify(user_it, RamPayer::of(users, coopname), [&](auto &row) {
      row.programs.push_back(pa);
    });
  }
}
