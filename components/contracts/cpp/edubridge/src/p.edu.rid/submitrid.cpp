/**
 * @brief Преподаватель подаёт Заявление о паевом взносе результатом
 * интеллектуальной деятельности (РИД).
 *
 * Открывает процесс p.edu.rid: заявление (шаблон 3008) публикуется в реестр
 * документов, а в RAM заводится запись ожидания решения совета с оценкой РИД
 * (`amount`) и его видом (`rid_type`). Движений средств на этом шаге нет —
 * паевой фонд пополняется только по решению совета и акту (`acceptrid`).
 *
 * Guards:
 *  - amount > 0 в _root_govern_symbol; подпись Заявления валидна (username);
 *  - rid_hash ещё не занят;
 *  - преподаватель — активный член кооператива с действующим договором УХД.
 *
 * @ingroup public_edubridge_actions
 */
void edubridge::submitrid(eosio::name coopname,
                          eosio::name username,
                          checksum256 rid_hash,
                          uint64_t assignment_id,
                          eosio::asset amount,
                          eosio::name rid_type,
                          document2 statement) {
  require_auth(coopname);

  Edubridge::check_money(amount, "Сумма паевого взноса РИД");
  eosio::check(!is_empty_document(statement),
               "Отсутствует заявление о паевом взносе результатом интеллектуальной деятельности");
  verify_document_or_fail(statement, { username });

  get_participant_or_fail(coopname, username);
  // Паевой взнос результатом работы возможен только по действующему договору УХД
  // (подписан преподавателем и председателем — p.edu.teach).
  Edubridge::get_active_contract_or_fail(coopname, username);

  edu_rids_index rids(_edubridge, coopname.value);
  auto by_hash = rids.get_index<"byhash"_n>();
  eosio::check(by_hash.find(rid_hash) == by_hash.end(),
               "Заявление о паевом взносе РИД с указанным hash уже существует");

  rids.emplace(_edubridge, [&](auto& r) {
    r.id             = get_global_id_in_scope(_edubridge, coopname, "edurids"_n);
    r.rid_hash       = rid_hash;
    r.username       = username;
    r.assignment_id  = assignment_id;
    r.amount         = amount;
    r.rid_type       = rid_type;
    r.statement_hash = statement.hash;
    r.created_at     = eosio::time_point_sec(eosio::current_time_point());
  });

  // Заявление публикуется в реестр документов пакетом процесса (package = rid_hash).
  Soviet::make_complete_document(_edubridge, coopname, username,
                                 "submitrid"_n,
                                 rid_hash, statement);
}
