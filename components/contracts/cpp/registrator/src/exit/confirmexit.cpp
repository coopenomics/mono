/**
 * @brief Одобрение советом выхода пайщика из кооператива.
 * Совет одобрил заявление о выходе. Контракт сам вычисляет сумму возврата:
 * обходит сет паевых кошельков LEDGER2_EXIT_REFUND_WALLETS (w.reg.minshr +
 * w.wal.share + w.cap.blago), собирает доступный L3-баланс каждого, консолидирует
 * на главный паевой (w.wal.share), резервирует всю сумму (o.wal.wthreq) и создаёт
 * исходящий платёж в gateway. Если возвращать нечего — выход завершается сразу
 * без платежа.
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
  // клиенту. Обходим сет паевых («боевых») кошельков LEDGER2_EXIT_REFUND_WALLETS
  // (источник истины — wallets.hpp; он же генерируется в cooptypes для
  // backend-preview, поэтому расчёт на фронте совпадает с этим): аккумулируем
  // доступный баланс каждого (>0) и тут же консолидируем его на главный паевой
  // (w.wal.share), чтобы единым платежом вернуть весь паевой через o.wal.*.
  eosio::asset total_return = eosio::asset(0, _root_govern_symbol);
  for (const auto &wallet_name : LEDGER2_EXIT_REFUND_WALLETS) {
    eosio::asset balance = Registrator::get_user_wallet_available(coopname, wallet_name, username);
    if (balance.amount <= 0) continue;
    total_return += balance;
    Registrator::consolidate_share_to_main(coopname, username, wallet_name, balance, exit_hash);
  }

  exits.modify(e, _soviet, [&](auto &row) {
    row.status = "authorized"_n;
    row.approved_statement = authorization;
    row.quantity = total_return;
  });

  if (total_return.amount > 0) {
    // Резервируем сумму возврата: w.wal.share → w.wal.wpend (o.wal.wthreq).
    std::string memo_req = "Резерв паевого взноса под выход из кооператива, username=" + username.to_string();
    Ledger2::apply(_registrator, coopname, operations::wallet::REQUEST_WITHDRAW,
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
    // Возвращать нечего — финализируем выход без платежа.
    Registrator::finalize_member_exit(coopname, username);
    exits.erase(e);
  }
}
