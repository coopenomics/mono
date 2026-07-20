/**
 * @brief Callback от gateway — банковский перевод по расходу КУ не
 * состоялся (requirement b6 «Экономика КУ», раунд 5; процесс p.brn.spend).
 *
 * Ledger2-операция НЕ применяется: средства остаются на общем кошельке
 * кооперативного участка (w.brn.common), команду можно подать повторно с
 * новым идентификатором. Терминал жизненного цикла: запись команды стирается
 * из RAM, причина отказа остаётся в журнале действий (аргумент reason).
 *
 * Guards:
 *  - require_auth(_gateway);
 *  - команда найдена по outcome_hash.
 *
 * @ingroup public_branch_actions
 */
[[eosio::action]] void branch::spenddecline(eosio::name coopname,
                                             eosio::checksum256 outcome_hash,
                                             std::string reason) {
  require_auth(_gateway);

  branch_spends_index spends(_branch, coopname.value);
  auto byhash = spends.get_index<"byhash"_n>();
  auto it = byhash.find(outcome_hash);
  eosio::check(it != byhash.end(),
               "Команда оплаты расхода не найдена по outcome_hash из callback'а gateway");

  byhash.erase(it);
}
