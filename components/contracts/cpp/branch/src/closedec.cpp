/**
 * @brief Закрытие собрания и утверждение протокола председателем.
 * Председатель закрывает голосование и утверждает протокол одной своей подписью
 * (секретарь не нужен — подсчёт ведёт контракт). Проверяется кворум и итог
 * голосования. Для типа "free" — терминал: запись стирается (история — в журнале).
 * Для "createbranch" — решение переходит в статус "approved" в ожидании исполнения
 * действием exec (вывод вопроса на совет).
 * @param coopname Наименование кооператива
 * @param hash Якорь процесса
 * @param protocol Подписанный председателем протокол решения
 * @ingroup public_actions
 * @ingroup public_branch_actions

 * @note Авторизация требуется от аккаунта: @p coopname
 */
[[eosio::action]] void branch::closedec(eosio::name coopname, eosio::checksum256 hash, document2 protocol) {
  check_auth_or_fail(_branch, coopname, coopname, "closedec"_n);

  verify_document_or_fail(protocol);

  auto dec = get_decision_or_fail(coopname, hash);
  eosio::check(dec.status == "voting"_n, "Решение не находится в стадии голосования");

  // Кворум: число поданных бюллетеней не меньше минимального
  eosio::check(dec.signed_ballots >= MIN_DECISION_QUORUM, "Не набран минимальный кворум собрания");

  // Закрыть может только по истечении окна голосования либо когда проголосовали все участники
  auto now = current_time_point();
  bool window_passed = now.sec_since_epoch() > dec.close_at.sec_since_epoch();
  bool all_voted = dec.signed_ballots >= dec.participants.size();
  eosio::check(window_passed || all_voted, "Голосование ещё идёт");

  // Протокол собрания пайщиков завершает ПАКЕТ СОБРАНИЯ в реестре — его якорь = хэш
  // предложения/повестки (proposal.hash), к нему же привязаны бюллетени (см. votedec).
  // Пакет появляется в реестре сразу при закрытии собрания. Отправка в совет (exec) —
  // ОТДЕЛЬНЫЙ пакет на хэше процесса (hash), чтобы документы собрания и документы совета
  // не сваливались в одну кашу под общим якорем.
  Soviet::make_complete_document(_branch, coopname, dec.initiator, get_valid_soviet_action("branchdec"_n), dec.proposal.hash, protocol);

  if (dec.type == "free"_n) {
    // Свободное решение зафиксировано протоколом и завершается (история — в журнале действий)
    decision_index decisions(_branch, coopname.value);
    auto itr = decisions.find(dec.id);
    erase_coodecquests(coopname, dec.id);
    decisions.erase(itr);
    return;
  }

  // Автоматизируемое решение — переходит в ожидание исполнения (exec → совет)
  decision_index decisions(_branch, coopname.value);
  auto itr = decisions.find(dec.id);
  decisions.modify(itr, coopname, [&](auto &d) {
    d.status = "approved"_n;
    d.protocol = protocol;
  });
}
