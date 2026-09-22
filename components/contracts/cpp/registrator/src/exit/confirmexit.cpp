/**
 * @brief Одобрение советом выхода пайщика из кооператива.
 * Совет одобрил заявление о выходе. Контракт сам вычисляет сумму возврата:
 * обходит таблицу EXIT_WALLET_POLICY, собирает доступный L3-баланс кошельков,
 * которые возвращаются пайщику, консолидирует их на главный паевой
 * (w.wal.share), резервирует всю сумму (o.wal.wthreq) и создаёт исходящий
 * платёж в gateway. Если возвращать нечего — выход завершается сразу без
 * платежа.
 * @param coopname Наименование кооператива
 * @param exit_hash Хэш процесса выхода
 * @param authorization Документ-решение совета о выходе
 * @ingroup public_actions
 * @ingroup public_registrator_actions

 * @note Авторизация требуется от аккаунта: @p soviet
 */
void registrator::confirmexit(eosio::name coopname, checksum256 exit_hash, document2 authorization) {
  require_auth(_soviet);

  auto exist = Registrator::get_exit_by_hash(coopname, exit_hash);
  eosio::check(exist.has_value(), "Объект выхода не найден");

  Registrator::exits_index exits(_registrator, coopname.value);
  auto e = exits.find(exist->username.value);
  eosio::check(e->status == "pending"_n, "Только ожидающие заявления на выход могут быть одобрены");

  eosio::name username = e->username;

  // оповещаем пайщика
  require_recipient(username);

  // Контракт сам считает сумму возврата по L3-балансам ledger2 — не доверяем
  // клиенту. Обходим таблицу EXIT_WALLET_POLICY (источник истины —
  // lib/core/ledger2/exit_policy.hpp; она же генерируется в cooptypes для
  // backend-preview, поэтому расчёт на столе совпадает с этим): аккумулируем
  // доступный баланс возвращаемых кошельков (>0) и тут же консолидируем его на
  // главный паевой (w.wal.share), чтобы единым платежом вернуть всё через
  // o.wal.*. Программы могли получить новые обязательства до одобрения — выход
  // ждёт их завершения (проверки в shared-слое и остатки кошельков-блокеров).
  Core::Registrator::check_member_can_exit(coopname, username);

  // Выход закрывает участие пайщика в целевых потребительских программах, и
  // основание для этого — его заявление (registry 190). Без него совет вывел
  // бы пайщика, оставив соглашения действующими.
  eosio::check(e->annulment_statement.has_value() || !Core::Registrator::has_program_agreements(coopname, username),
               "К заявлению на выход не приложено заявление об аннулировании соглашений ЦПП");

  eosio::asset total_return = eosio::asset(0, _root_govern_symbol);
  for (size_t i = 0; i < EXIT_WALLET_POLICY_SIZE; ++i) {
    const auto &rule = EXIT_WALLET_POLICY[i];
    if (rule.policy != ExitWalletPolicy::MAIN && rule.policy != ExitWalletPolicy::RETURN_TO_MAIN) continue;
    eosio::asset balance = Ledger2::get_user_available(coopname, rule.wallet, username);
    if (balance.amount <= 0) continue;
    total_return += balance;
    Registrator::consolidate_share_to_main(coopname, username, rule, balance, exit_hash);
  }

  exits.modify(e, RamPayer::of(exits, coopname), [&](auto &row) {
    row.status = "authorized"_n;
    row.approved_statement = authorization;
    row.quantity = total_return;
  });

  if (total_return.amount > 0) {
    // Резервируем сумму возврата: w.wal.share → w.wal.wpend (o.wal.wthreq).
    std::string memo_req = "Резерв паевого взноса под выход из кооператива, username=" + username.to_string();
    Ledger2::apply(_registrator, coopname, operations::wallet::REQUEST_WITHDRAW,
                   processes::wallet::WITHDRAW,
                   total_return, username, exit_hash, memo_req);

    // Создаём исходящий платёж в gateway с коллбэками completexit/declinexit.
    Action::send<createoutpay_interface>(
      _gateway,
      "createoutpay"_n,
      _registrator,
      coopname,
      username,
      exit_hash,
      total_return,
      _registrator,
      "completexit"_n,
      "declinexit"_n
    );
  } else {
    // Возвращать нечего — финализируем выход без платежа. Членские кошельки
    // программ закрываются в момент, когда выход состоялся (задачи 99D-15, 99D-16).
    Core::Registrator::settle_program_wallets_on_exit(_registrator, coopname, username, exit_hash);
    Registrator::finalize_member_exit(coopname, username);
    exits.erase(e);
  }
}
