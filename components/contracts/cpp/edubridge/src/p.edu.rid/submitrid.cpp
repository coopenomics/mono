/**
 * @brief Преподаватель подаёт Заявление о паевом взносе результатом
 * интеллектуальной деятельности (РИД).
 *
 * Продолжает процесс p.edu.rid, открытый приёмом материалов на ответственное
 * хранение (`holdrid`). Гарантийный срок курса истёк, материалы остались у
 * кооператива — преподаватель просит принять их в паевой фонд. Заявление
 * (шаблон 3008) публикуется в реестр документов, и тем же действием контракт
 * ставит вопрос в повестку совета: инлайн `soviet::createagenda` с
 * `type=eduacptrid`, `hash=rid_hash`, документом повестки — этим заявлением и
 * обратными вызовами `onridauth` / `onriddecl`. Совет подписывает протокол
 * (шаблон 3009) по заявлению — как по возврату в Столе заказов. Движений
 * средств на этом шаге нет: паевой фонд признаётся по решению совета и акту
 * (`acceptrid`).
 *
 * Guards:
 *  - материалы с rid_hash приняты на хранение и гарантийный срок истёк;
 *  - оценка, вид результата и задание совпадают с принятыми на хранение;
 *  - заявление по этим материалам ещё не подано;
 *  - подпись Заявления валидна (username);
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
               "EDUBRIDGE_RID_STATEMENT_REQUIRED: Отсутствует заявление о паевом взносе результатом интеллектуальной деятельности");
  verify_document_or_fail(statement, { username });
  verify_signer_keys_or_fail(statement, username);

  get_participant_or_fail(coopname, username);
  // Паевой взнос результатом работы возможен только по действующему договору УХД
  // (подписан преподавателем и председателем — p.edu.teach).
  Edubridge::get_active_contract_or_fail(coopname, username);

  edu_rids_index rids(_edubridge, coopname.value);
  auto rid = Edubridge::get_rid_or_fail(rids, rid_hash);

  eosio::check(rid->username == username,
               "EDUBRIDGE_RID_NOT_OWNER: Материалы на ответственном хранении приняты от другого пайщика");
  eosio::check(rid->statement_hash == checksum256(),
               "EDUBRIDGE_RID_STATEMENT_ALREADY_SUBMITTED: Заявление о паевом взносе по этим материалам уже подано");
  eosio::check(rid->amount == amount,
               "EDUBRIDGE_RID_AMOUNT_MISMATCH: Сумма заявления расходится с оценкой материалов на ответственном хранении");
  eosio::check(rid->rid_type == rid_type,
               "EDUBRIDGE_RID_TYPE_MISMATCH: Вид результата расходится с принятым на ответственное хранение");
  eosio::check(rid->assignment_id == assignment_id,
               "EDUBRIDGE_RID_ASSIGNMENT_MISMATCH: Задание расходится с принятым на ответственное хранение");

  // Пока идёт гарантийный срок курса, материалы остаются на ответственном
  // хранении и в совет не уходят (решение владельца 20.09.2026).
  eosio::check(eosio::time_point_sec(eosio::current_time_point()) >= rid->hold_until,
               "EDUBRIDGE_RID_GUARANTEE_RUNNING: Гарантийный срок по материалам занятия ещё идёт");

  rids.modify(rid, RamPayer::of(rids, coopname), [&](auto& r) {
    r.statement_hash = statement.hash;
  });

  // Заявление публикуется в реестр документов пакетом процесса (package = rid_hash).
  Soviet::make_complete_document(_edubridge, coopname, username,
                                 "submitrid"_n,
                                 rid_hash, statement);

  // Повестка совета: hash = rid_hash, чтобы обратные вызовы нашли материалы;
  // автор повестки — преподаватель, документ — его заявление; протокол 3009
  // берёт деловые поля из метаданных заявления.
  action(permission_level{_edubridge, "active"_n}, _soviet, "createagenda"_n,
    std::make_tuple(
      coopname,
      username,
      get_valid_soviet_action(_edubridge_rid_action),
      rid_hash,
      _edubridge,
      "onridauth"_n,
      "onriddecl"_n,
      statement,
      std::string("")
    )
  ).send();
}
