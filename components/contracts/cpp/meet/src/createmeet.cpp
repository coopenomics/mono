/**
 * @brief Создание общего собрания.
 * Создает новое общее собрание пайщиков с повесткой дня и участниками
 * @param coopname Наименование кооператива
 * @param hash Хэш собрания
 * @param initiator Инициатор собрания
 * @param presider Председатель собрания
 * @param secretary Секретарь собрания
 * @param agenda Повестка дня собрания
 * @param proposal Предложение о проведении собрания
 * @param open_at Дата и время открытия собрания
 * @param close_at Дата и время закрытия собрания
 * @ingroup public_actions
 * @ingroup public_meet_actions

 * @note Авторизация требуется от аккаунта: @p coopname
 */
void meet::createmeet(name coopname, checksum256 hash, eosio::name initiator, name presider, name secretary, std::vector<meet_point> agenda, document2 proposal, time_point_sec open_at, time_point_sec close_at) {
  require_auth(coopname);
  
  verify_document_or_fail(proposal);
  
  auto exist = get_meet(coopname, hash);
  eosio::check(!exist.has_value(), "Объект общего собрания с указанным идентификатором уже существует");
  
  auto coop = get_cooperative_or_fail(coopname);
  
  get_active_participant_or_fail(coopname, initiator);
  get_active_participant_or_fail(coopname, presider);
  get_active_participant_or_fail(coopname, secretary);
  
  auto now = current_time_point();
  
  if (!TEST_MODE) {
    check(open_at.sec_since_epoch() >= now.sec_since_epoch() + MIN_OPEN_AGM_DELAY_SEC, "Дата открытия должна быть по-крайней мере через 15 дней от сегодня");
  }
  check(close_at.sec_since_epoch() > open_at.sec_since_epoch(), "Дата закрытия должна быть после даты открытия");
  
  Meet::meets_index genmeets(_meet, coopname.value);
  
  uint64_t meet_id = get_global_id_in_scope(_meet, coopname, "genmeets"_n);
  
  genmeets.emplace(coopname, [&](auto &g){
    g.id = meet_id;
    g.hash = hash;
    g.coopname = coopname;
    g.type = "regular"_n;
    g.level = "cooperative"_n;
    g.initiator = initiator;
    g.presider = presider;
    g.secretary = secretary;
    g.status = "created"_n;
    g.created_at = current_time_point();
    g.open_at = open_at;
    g.close_at = close_at;
    g.proposal = proposal;
  });

  Meet::questions_index questions(_meet, coopname.value);
  
  uint64_t number = 0;
  
  for (const auto& point : agenda) {
    check(!point.title.empty(), "Вопрос должен содержать заголовок (title)");
    check(!point.decision.empty(), "Вопрос должен содержать проект решения (decision)");

    number++;
    eosio::check(number <= 10, "Не больше 10 вопросов на повестке собрания");
    
    questions.emplace(coopname, [&](auto& q) {
      q.id = get_global_id_in_scope(_meet, coopname, "questions"_n);
      q.number = number;
      q.coopname = coopname;
      q.title = point.title;
      q.decision = point.decision;
      q.context = point.context; // context может быть пустым
      q.meet_id = meet_id;
    });
  }
  
  ::Soviet::create_agenda(
    _meet,
    coopname, 
    initiator, 
    get_valid_soviet_action("creategm"_n), 
    hash,
    _meet,
    "authmeet"_n, 
    "declmeet"_n, 
    proposal, 
    std::string("")
  );
}
