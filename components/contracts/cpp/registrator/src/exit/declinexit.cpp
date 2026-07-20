/**
 * @brief Отказ в выходе из кооператива.
 * Вызывается либо советом при отклонении заявления (до резервирования средств),
 * либо gateway при отклонении исходящего платежа (после резервирования). Если
 * сумма возврата уже была зарезервирована — снимаем резерв (o.wal.wthdec:
 * w.wal.wpend → w.wal.share). Пайщик остаётся действующим членом кооператива.
 * @param coopname Наименование кооператива
 * @param exit_hash Хэш процесса выхода
 * @param reason Причина отказа
 * @ingroup public_actions
 * @ingroup public_registrator_actions

 * @note Авторизация требуется от аккаунта: @p soviet или @p gateway
 */
void registrator::declinexit(eosio::name coopname, checksum256 exit_hash, std::string reason) {
  check_auth_and_get_payer_or_fail({_soviet, _gateway});

  auto exist = Registrator::get_exit_by_hash(coopname, exit_hash);
  eosio::check(exist.has_value(), "Объект выхода не найден");

  Registrator::exits_index exits(_registrator, coopname.value);
  auto e = exits.find(exist->username.value);

  eosio::name username = e->username;

  // Если резерв уже был сделан (отказ платежа после одобрения советом) —
  // снимаем его, возвращая средства пайщику на главный паевой кошелёк.
  // Минимальный паевой, ранее консолидированный на главный (o.reg.mvmin),
  // остаётся на w.wal.share: пайщик сохраняет полную сумму паевого, аналитика
  // минимального/целевого разреза при несостоявшемся выходе не восстанавливается.
  if (e->status == "authorized"_n && e->quantity.amount > 0) {
    std::string memo = "Снятие резерва паевого при отмене выхода из кооператива: " + reason;
    Ledger2::apply(_registrator, coopname, operations::wallet::DECLINE_WITHDRAW,
                   e->quantity, username, exit_hash, memo);
  }

  // оповещаем пайщика
  require_recipient(username);

  exits.erase(e);
}
