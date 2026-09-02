/**
 * @brief Преподаватель подписывает Приложение к договору УХД на курс —
 * первая подпись. Приложение уходит председателю совета на вторую подпись
 * через одобрение.
 *
 * Guards:
 *  - у преподавателя действующий договор УХД (подписан обеими сторонами);
 *  - приложение подписано преподавателем; hash совпадает с annex_hash;
 *  - annex_hash ещё не занят.
 *
 * @ingroup public_edubridge_actions
 */
void edubridge::signannex(eosio::name coopname,
                          eosio::name username,
                          uint64_t course_id,
                          checksum256 annex_hash,
                          document2 annex) {
  require_auth(coopname);

  eosio::check(!is_empty_document(annex), "Отсутствует приложение к договору");
  eosio::check(annex.hash == annex_hash, "Hash приложения не совпадает с переданным документом");
  verify_document_or_fail(annex, { username });

  get_participant_or_fail(coopname, username);
  auto contract = Edubridge::get_active_contract_or_fail(coopname, username);

  edu_annexes_index annexes(_edubridge, coopname.value);
  auto by_hash = annexes.get_index<"byhash"_n>();
  eosio::check(by_hash.find(annex_hash) == by_hash.end(), "Приложение с указанным hash уже существует");

  annexes.emplace(_edubridge, [&](auto& a) {
    a.id            = get_global_id_in_scope(_edubridge, coopname, "eduannexes"_n);
    a.username      = username;
    a.course_id     = course_id;
    a.contract_hash = contract.contract_hash;
    a.annex_hash    = annex_hash;
    a.created_at    = eosio::time_point_sec(eosio::current_time_point());
  });

  ::Soviet::create_approval(
    _edubridge,
    coopname,
    username,
    annex,
    Names::Edubridge::SIGN_ANNEX,
    annex_hash,
    _edubridge,
    Names::Edubridge::APPROVE_ANNEX,
    Names::Edubridge::DECLINE_ANNEX,
    std::string("")
  );
}
