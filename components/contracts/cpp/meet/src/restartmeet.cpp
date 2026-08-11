/**
 * @brief Перезапуск собрания.
 * Перезапускает собрание с новыми параметрами при несостоявшемся кворуме
 * @param coopname Наименование кооператива
 * @param hash Хэш текущего собрания
 * @param new_hash Хэш нового собрания
 * @param newproposal Новое предложение о проведении собрания
 * @param new_open_at Новая дата и время открытия собрания
 * @param new_close_at Новая дата и время закрытия собрания
 * @ingroup public_actions
 * @ingroup public_meet_actions

 * @note Авторизация требуется от аккаунта: @p coopname
 */
void meet::restartmeet(name coopname, checksum256 hash, checksum256 new_hash, document2 newproposal, time_point_sec new_open_at, time_point_sec new_close_at) {
    require_auth(coopname);

    // Получаем объект собрания
    auto meet_opt = get_meet(coopname, hash);
    eosio::check(meet_opt.has_value(), "Собрание не найдено");
    auto meet_record = meet_opt.value();

    // Проверяем, что новый хэш отличается от старого
    eosio::check(hash != new_hash, "Новый хэш должен отличаться от старого");

    // Проверяем, что собрание закрыто и кворум не пройден
    auto now = current_time_point();
    eosio::check(now.sec_since_epoch() > meet_record.close_at.sec_since_epoch(), "Собрание ещё не закрыто");
    eosio::check(meet_record.quorum_passed == false, "Собрание прошло кворум, перезапуск невозможен");

    // Валидируем новые даты
    if (!TEST_MODE) {
        eosio::check(new_open_at.sec_since_epoch() >= now.sec_since_epoch() + MIN_OPEN_AGM_DELAY_SEC, "Дата открытия должна быть не менее чем через 15 дней от текущего момента");
    }
    eosio::check(new_close_at.sec_since_epoch() > new_open_at.sec_since_epoch(), "Дата закрытия должна быть после даты открытия");

    // Проверяем документ нового предложения
    verify_document_or_fail(newproposal);

    // Обновляем запись собрания
    Meet::meets_index genmeets(_meet, coopname.value);
    auto meet_itr = genmeets.find(meet_record.id);
    eosio::check(meet_itr != genmeets.end(), "Собрание не найдено при обновлении");

    uint64_t old_cycle = meet_itr->cycle;
    double old_quorum = meet_itr->quorum_percent;
    
    document2 empty_document;
    
    genmeets.modify(meet_itr, coopname, [&](auto &m) {
        m.hash              = new_hash;  // Заменяем старый хэш на новый
        m.status            = "onrestart"_n;
        m.proposal          = newproposal;
        m.authorization     = empty_document;
        m.open_at           = new_open_at;
        m.close_at          = new_close_at;
        m.signed_ballots    = 0;
        m.current_quorum_percent = 0.0;
        m.quorum_passed     = false;
      
        m.cycle++; // переходим к следующему циклу
        
        // Уменьшаем требуемый процент кворума по заданной логике:
        //  1) при cycle=2 -> 50%
        //  2) при cycle>=3 -> делим предыдущее значение вдвое,
        //     но не опускаемся ниже MIN_QUORUM_PERCENT (25%).
        // Планка 25% — нижняя граница: сколько бы раз собрание ни
        // перезапускалось, требование к явке остаётся 25%.
        double next_quorum = (old_cycle == 1) ? 50.0 : old_quorum / 2.0;
        m.quorum_percent = std::max(next_quorum, MIN_QUORUM_PERCENT);
        m.notified_users.clear(); // Очищаем уведомления
    });

    // Обнуляем состояние голосования по всем вопросам данного собрания
    Meet::questions_index questions(_meet, coopname.value);
    auto questions_by_meet = questions.get_index<"bymeet"_n>();

    for (auto idx_itr = questions_by_meet.lower_bound(meet_record.id);
        idx_itr != questions_by_meet.end() && idx_itr->meet_id == meet_record.id;
        ++idx_itr)
    {
        auto main_itr = questions.find(idx_itr->primary_key());
        eosio::check(main_itr != questions.end(), "Не найден вопрос в основном индексе");

        questions.modify(main_itr, coopname, [&](auto &q) {
            q.counter_votes_for = 0;
            q.counter_votes_against = 0;
            q.counter_votes_abstained = 0;
            q.voters_for.clear();
            q.voters_against.clear();
            q.voters_abstained.clear();
        });
    }

    // Отправляем документ решения в совет
    ::Soviet::create_agenda(
        _meet,
        coopname,
        meet_record.initiator,
        get_valid_soviet_action("creategm"_n),
        new_hash,  // Используем новый хэш
        _meet,
        "authmeet"_n,
        "declmeet"_n,
        newproposal,
        std::string("")
    );
}
