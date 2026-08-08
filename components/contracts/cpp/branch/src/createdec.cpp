/**
 * @brief Объявление собрания пайщиков с повесткой (создание решения).
 * Универсальный механизм: тип "free" — свободное решение (фиксируется протоколом),
 * тип "createbranch" — автоматизируемое (после утверждения уходит в совет и создаёт КУ).
 * @param coopname Наименование кооператива
 * @param hash Якорь процесса (внешний идентификатор решения)
 * @param type Тип решения: "free" | "createbranch"
 * @param initiator Организатор собрания
 * @param proposal Подписанное предложение/повестка
 * @param braname Заранее сгенерированный аккаунт будущего КУ (для "createbranch", иначе пустое)
 * @param agenda Вопросы повестки дня
 * @ingroup public_actions
 * @ingroup public_branch_actions

 * @note Авторизация требуется от аккаунта: @p coopname
 */
[[eosio::action]] void branch::createdec(eosio::name coopname, eosio::checksum256 hash, eosio::name type, eosio::name initiator, document2 proposal, eosio::name braname, std::vector<decision_point> agenda) {
  check_auth_or_fail(_branch, coopname, coopname, "createdec"_n);

  verify_document_or_fail(proposal);

  eosio::check(type == "free"_n || type == "createbranch"_n, "Недопустимый тип решения");

  get_cooperative_or_fail(coopname);
  get_participant_or_fail(coopname, initiator);

  decision_index decisions(_branch, coopname.value);
  auto idx = decisions.get_index<"byhash"_n>();
  eosio::check(idx.find(hash) == idx.end(), "Решение с указанным идентификатором уже существует");

  eosio::check(!agenda.empty(), "Повестка дня не может быть пустой");

  if (type == "createbranch"_n) {
    eosio::check(braname != ""_n, "Для создания кооперативного участка требуется аккаунт участка");
  }

  uint64_t decision_id = get_global_id_in_scope(_branch, coopname, "decisions"_n);

  decisions.emplace(coopname, [&](auto &d) {
    d.id = decision_id;
    d.hash = hash;
    d.coopname = coopname;
    d.type = type;
    d.initiator = initiator;
    d.chairman = ""_n;  // председатель выбирается организатором из участников при открытии голосования
    d.status = "opened"_n;
    d.proposal = proposal;
    d.signed_ballots = 0;
    d.braname = braname;
    d.participants = {initiator};  // организатор сразу участник
    d.created_at = current_time_point();
  });

  coodecquest_index questions(_branch, coopname.value);
  uint64_t number = 0;

  for (const auto &point : agenda) {
    eosio::check(!point.title.empty(), "Вопрос должен содержать заголовок");
    eosio::check(!point.decision.empty(), "Вопрос должен содержать проект решения");

    number++;
    eosio::check(number <= 10, "Не больше 10 вопросов на повестке собрания");

    questions.emplace(coopname, [&](auto &q) {
      q.id = get_global_id_in_scope(_branch, coopname, "decisionq"_n);
      q.decision_id = decision_id;
      q.number = number;
      q.coopname = coopname;
      q.title = point.title;
      q.decision = point.decision;
      q.context = point.context;
      q.counter_votes_for = 0;
      q.counter_votes_against = 0;
      q.counter_votes_abstained = 0;
    });
  }
}
