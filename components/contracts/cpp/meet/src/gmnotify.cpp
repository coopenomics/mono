/**
 * @brief Уведомление о собрании.
 * Регистрирует уведомление пользователя о проведении собрания
 * @param coopname Наименование кооператива
 * @param hash Хэш собрания
 * @param username Имя пользователя, уведомляющего о собрании
 * @param notification Документ уведомления
 * @ingroup public_actions
 * @ingroup public_meet_actions

 * @note Авторизация требуется от аккаунта: @p coopname
 */
void meet::gmnotify(name coopname, checksum256 hash, name username, document2 notification) {
    require_auth(coopname);

    // Проверяем документ уведомления
    verify_document_or_fail(notification);
    // Уведомление подписывает тот, от чьего имени оно подано.
    verify_signer_keys_or_fail(notification, username);

    // Получаем собрание по хэшу
    Meet::meets_index genmeets(_meet, coopname.value);
    auto meet_idx = genmeets.get_index<"byhash"_n>();
    auto meet_itr = meet_idx.find(hash);
    eosio::check(meet_itr != meet_idx.end(), "Собрание не найдено");

    // Собрание уполномоченных по закреплённой форме: получение уведомления
    // подтверждают председатели участков, входящих в собрание. Собрания без
    // формы (одобрены до её появления) подтверждаются по прежним правилам.
    if (meet_itr->form.has_value() && meet_itr->form.value().is_branched) {
        auto branch = Branch::get_trustee_branch(coopname, username);
        eosio::check(branch.has_value(),
                     "MEET_NOT_TRUSTEE: Уведомление о собрании уполномоченных подтверждают только председатели кооперативных участков");
        eosio::check(!branch->is_created_after(meet_itr->form.value().fixed_at),
                     "MEET_BRANCH_NOT_IN_MEET: Кооперативный участок создан после объявления собрания и в собрании не участвует");
    }

    // Проверяем, что пользователь ещё не уведомлял
    const auto& notified = meet_itr->notified_users;
    eosio::check(std::find(notified.begin(), notified.end(), username) == notified.end(), "Пользователь уже подписал уведомление");

    // Добавляем пользователя
    meet_idx.modify(meet_itr, RamPayer::of(meet_idx, coopname), [&](auto& m) {
        m.notified_users.push_back(username);
    });
    
    Action::send<newlink_interface>(
      _soviet,
      "newlink"_n,
      _meet,
      coopname,
      username,
      get_valid_soviet_action("gmnotify"_n),
      hash,
      notification
    );
}
