/**
 * @brief Голосование по вопросам повестки бюллетенем.
 * Участник подаёт бюллетень-заявление с волеизъявлением (за/против/воздержался)
 * по каждому вопросу повестки. Подсчёт ведёт контракт. Адаптация meet::vote.
 * @param coopname Наименование кооператива
 * @param hash Якорь процесса
 * @param username Имя голосующего участника
 * @param ballot Подписанный бюллетень
 * @param votes Массив голосов по вопросам повестки
 * @ingroup public_actions
 * @ingroup public_branch_actions

 * @note Авторизация требуется от аккаунта: @p coopname
 */
[[eosio::action]] void branch::votedec(eosio::name coopname, eosio::checksum256 hash, eosio::name username, document2 ballot, std::vector<decision_vote_point> votes) {
  check_auth_or_fail(_branch, coopname, coopname, "votedec"_n);

  verify_document_or_fail(ballot);

  auto dec = get_decision_or_fail(coopname, hash);
  eosio::check(dec.status == "voting"_n, "Голосование не открыто");
  eosio::check(dec.is_participant(username), "Голосовать может только участник собрания");

  auto now = current_time_point();
  eosio::check(now.sec_since_epoch() >= dec.open_at.sec_since_epoch(), "Голосование ещё не началось");
  eosio::check(now.sec_since_epoch() <= dec.close_at.sec_since_epoch(), "Голосование завершено");

  // Собираем вопросы данного решения
  coodecquest_index questions(_branch, coopname.value);
  auto by_dec = questions.get_index<"bydecision"_n>();
  std::vector<coodecquest> decision_questions;
  for (auto itr = by_dec.lower_bound(dec.id); itr != by_dec.end() && itr->decision_id == dec.id; ++itr) {
    decision_questions.push_back(*itr);
  }
  eosio::check(votes.size() == decision_questions.size(), "Бюллетень должен содержать голоса по всем вопросам");

  // Бюллетень покрывает все вопросы без дублирования
  std::set<uint64_t> question_ids;
  for (const auto &q : decision_questions) {
    question_ids.insert(q.id);
  }
  std::set<uint64_t> voted_ids;
  for (const auto &v : votes) {
    eosio::check(question_ids.find(v.question_id) != question_ids.end(), "В бюллетене указан неизвестный вопрос");
    eosio::check(voted_ids.insert(v.question_id).second, "Дублирование голосов по одному вопросу недопустимо");
  }

  // Участник не голосовал ранее
  for (const auto &q : decision_questions) {
    auto already = [&](const std::vector<eosio::name> &voters) {
      return std::find(voters.begin(), voters.end(), username) != voters.end();
    };
    eosio::check(!already(q.voters_for) && !already(q.voters_against) && !already(q.voters_abstained), "Ваш голос уже учтён");
  }

  // Учитываем голоса
  for (const auto &v : votes) {
    auto qitr = questions.find(v.question_id);
    eosio::check(qitr != questions.end(), "Вопрос не найден");
    questions.modify(qitr, coopname, [&](auto &q) {
      if (v.vote == "for"_n) {
        q.counter_votes_for++;
        q.voters_for.push_back(username);
      } else if (v.vote == "against"_n) {
        q.counter_votes_against++;
        q.voters_against.push_back(username);
      } else if (v.vote == "abstained"_n) {
        q.counter_votes_abstained++;
        q.voters_abstained.push_back(username);
      } else {
        eosio::check(false, "Недопустимое значение голоса");
      }
    });
  }

  decision_index decisions(_branch, coopname.value);
  auto ditr = decisions.find(dec.id);
  decisions.modify(ditr, coopname, [&](auto &d) {
    d.signed_ballots++;
  });

  // Бюллетень линкуется к ПАКЕТУ СОБРАНИЯ (якорь = хэш предложения proposal.hash),
  // туда же закрывающим документом ляжет протокол (см. closedec). Не на хэш процесса,
  // иначе бюллетени попадут в пакет заявления в совет.
  Action::send<newlink_interface>(
    _soviet,
    "newlink"_n,
    _branch,
    coopname,
    username,
    get_valid_soviet_action("ballot"_n),
    dec.proposal.hash,
    ballot
  );
}
