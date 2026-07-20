/**
 * @brief Callback от gateway — банковский перевод материальной помощи не
 * состоялся (requirement b6 «Экономика КУ», процесс p.brn.aid).
 *
 * Ledger2-операция НЕ применяется: средства остаются на персональном
 * кошельке получателя (w.brn.person), он может подать заявку повторно с
 * новым идентификатором. Терминал жизненного цикла: запись заявки стирается
 * из RAM, причина отказа остаётся в журнале действий (аргумент reason).
 *
 * Guards:
 *  - require_auth(_gateway);
 *  - заявка найдена по outcome_hash.
 *
 * @ingroup public_branch_actions
 */
[[eosio::action]] void branch::aiddecline(eosio::name coopname,
                                           eosio::checksum256 outcome_hash,
                                           std::string reason) {
  require_auth(_gateway);

  branch_aids_index aids(_branch, coopname.value);
  auto byhash = aids.get_index<"byhash"_n>();
  auto it = byhash.find(outcome_hash);
  eosio::check(it != byhash.end(),
               "Заявка на материальную помощь не найдена по outcome_hash из callback'а gateway");

  byhash.erase(it);
}
