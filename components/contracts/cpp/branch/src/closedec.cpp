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

  if (dec.type == "free"_n) {
    // Свободное решение: протокол — самостоятельный завершённый документ (отдельный пакет в реестре).
    Soviet::make_complete_document(_branch, coopname, dec.initiator, get_valid_soviet_action("branchdec"_n), hash, protocol);
    // Решение зафиксировано протоколом и завершается (история — в журнале действий)
    decision_index decisions(_branch, coopname.value);
    auto itr = decisions.find(dec.id);
    erase_coodecquests(coopname, dec.id);
    decisions.erase(itr);
    return;
  }

  // Решение об учреждении участка: протокол НЕ заводит отдельный пакет, а линкуется по
  // якорному хэшу к пакету заявления председателя в совет (его заводит exec → create_agenda).
  // Иначе процесс плодит две почти одинаковые карточки документов (протокол + заявление)
  // вместо одной: заявление в совет — единственный statement пакета, всё прочее (протокол,
  // бюллетени, договор матответственности, доверенность, решение совета) — приложения к нему.
  Action::send<newlink_interface>(
    _soviet,
    "newlink"_n,
    _branch,
    coopname,
    dec.initiator,
    get_valid_soviet_action("branchdec"_n),
    hash,
    protocol
  );

  // Автоматизируемое решение — переходит в ожидание исполнения (exec → совет)
  decision_index decisions(_branch, coopname.value);
  auto itr = decisions.find(dec.id);
  decisions.modify(itr, coopname, [&](auto &d) {
    d.status = "approved"_n;
    d.protocol = protocol;
  });
}
