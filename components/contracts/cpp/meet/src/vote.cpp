// Заглушка для получения числа пайщиков кооператива.
uint64_t get_total_participants(eosio::name coopname) {
    // Получаем кооператив и проверяем режим участков
    auto cooperative = get_cooperative_or_fail(coopname);
    
    // Если включен режим кооперативных участков, используем количество участков
    if (cooperative.is_branched) {
        return Branch::get_branch_count(coopname);
    }
    
    // Иначе используем обычный подсчет активных пайщиков
    return Registrator::get_active_participants_count(coopname);
}

/**
 * @brief Голосование на собрании.
 * Регистрирует голос участника по вопросам повестки дня собрания
 * @param coopname Наименование кооператива
 * @param hash Хэш собрания
 * @param username Имя пользователя, голосующего на собрании
 * @param ballot Документ бюллетеня
 * @param votes Массив голосов по вопросам повестки
 * @ingroup public_actions
 * @ingroup public_meet_actions

 * @note Авторизация требуется от аккаунта: @p coopname
 */
void meet::vote(name coopname, checksum256 hash, name username, document2 ballot, std::vector<vote_point> votes) {
    require_auth(coopname);
    
    verify_document_or_fail(ballot);
    // Бюллетень подписывает сам голосующий: иначе чужим ключом можно было бы
    // проголосовать за пайщика — транзакцию во всех случаях шлёт кооператив.
    verify_signer_keys_or_fail(ballot, username);
    
    // Получаем объект собрания
    auto meet_opt = get_meet(coopname, hash);
    eosio::check(meet_opt.has_value(), "Собрание не найдено");
    auto meet_record = meet_opt.value();

    // Получаем кооператив для проверки режима участков
    auto cooperative = get_cooperative_or_fail(coopname);
    
    // Если включен режим кооперативных участков, проверяем что голосующий является уполномоченным
    if (cooperative.is_branched) {
        eosio::check(Branch::is_trustee(coopname, username), "Только уполномоченные кооперативных участков могут голосовать при режиме участков");
    }

    // Проверяем статус собрания и временное окно голосования
    eosio::check(meet_record.status == "authorized"_n, "Собрание не авторизовано для голосования");
    auto now = current_time_point();
    eosio::check(now.sec_since_epoch() >= meet_record.open_at.sec_since_epoch(), "Голосование еще не началось");
    eosio::check(now.sec_since_epoch() <= meet_record.close_at.sec_since_epoch(), "Голосование завершено");

    // Получаем все вопросы данного собрания по meet_id
    Meet::questions_index questions(_meet, coopname.value);
    auto questions_by_meet = questions.get_index<"bymeet"_n>();
    std::vector<Meet::question> meeting_questions;
    for (auto itr = questions_by_meet.lower_bound(meet_record.id);
         itr != questions_by_meet.end() && itr->meet_id == meet_record.id; ++itr) {
        meeting_questions.push_back(*itr);
    }
    eosio::check(votes.size() == meeting_questions.size(), "Бюллетень должен содержать голоса по всем вопросам");

    // Проверяем, что бюллетень содержит все идентификаторы вопросов без дублирования
    std::set<uint64_t> question_ids;
    for (const auto &q : meeting_questions) {
        question_ids.insert(q.id);
    }
    std::set<uint64_t> votes_ids;
    for (const auto &b : votes) {
        eosio::check(question_ids.find(b.question_id) != question_ids.end(), "В бюллетене указан неизвестный вопрос");
        bool inserted = votes_ids.insert(b.question_id).second;
        eosio::check(inserted, "Дублирование голосов по одному вопросу недопустимо");
    }

    // Проверяем, что участник ранее не голосовал по любому из вопросов
    for (const auto &q : meeting_questions) {
        auto already_voted = [&](const std::vector<name>& voters) -> bool {
            for (const auto &v : voters) {
                if (v == username) return true;
            }
            return false;
        };
        eosio::check(!already_voted(q.voters_for)
                  && !already_voted(q.voters_against)
                  && !already_voted(q.voters_abstained), "Ваш голос уже учтён");
    }

    // Обрабатываем каждый голос из бюллетеня и обновляем соответствующие записи в таблице questions
    for (const auto &b : votes) {
        auto qitr = questions.find(b.question_id);
        eosio::check(qitr != questions.end(), "Вопрос не найден");

        questions.modify(qitr, coopname, [&](auto &q) {
            if (b.vote == "for"_n) {
                q.counter_votes_for++;
                q.voters_for.push_back(username);
            } else if (b.vote == "against"_n) {
                q.counter_votes_against++;
                q.voters_against.push_back(username);
            } else if (b.vote == "abstained"_n) {
                q.counter_votes_abstained++;
                q.voters_abstained.push_back(username);
            } else {
                eosio::check(false, "Недопустимое значение голоса");
            }
        });
    }

    // Обновляем показатели кворума для собрания
    Meet::meets_index genmeets(_meet, coopname.value);
    auto meet_itr = genmeets.find(meet_record.id);
    eosio::check(meet_itr != genmeets.end(), "Собрание не найдено при обновлении кворума");
    genmeets.modify(meet_itr, coopname, [&](auto &m) {
        m.signed_ballots++; // регистрируем принятый бюллетень
        uint64_t total_participants = get_total_participants(coopname);
        if (total_participants == 0) {
            m.current_quorum_percent = 0;
        } else {
            m.current_quorum_percent = (static_cast<double>(m.signed_ballots) * 100.0) / static_cast<double>(total_participants);
        }
        if (m.current_quorum_percent > m.quorum_percent) {
            m.quorum_passed = true;
        }
    });

    // Подсчёт консенсуса для каждого вопроса:
    // Если голосов "за" больше 50% от общего числа бюллетеней, вопрос считается принятым.
    for (const auto &q : meeting_questions) {
        auto q_itr = questions.find(q.id);
        // Общее число голосов по вопросу равно числу поданных бюллетеней
        uint64_t total_votes = meet_itr->signed_ballots;
        if (total_votes > 0) {
            bool accepted = (q_itr->counter_votes_for * 100) > (total_votes * 50);
            // Здесь можно при необходимости обновить поле решения, логирование или вызвать inline action.
        }
    }
    
    Action::send<newlink_interface>(
      _soviet,
      "newlink"_n,
      _meet,
      coopname,
      username,
      get_valid_soviet_action("ballot"_n),
      hash,
      ballot
    );
}