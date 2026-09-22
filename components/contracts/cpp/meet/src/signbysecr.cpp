/**
 * @brief Подпись протокола секретарем.
 * Подписывает протокол собрания секретарем после успешного завершения
 * @param coopname Наименование кооператива
 * @param username Имя секретаря собрания
 * @param hash Хэш собрания
 * @param secretary_decision Документ решения секретаря
 * @ingroup public_actions
 * @ingroup public_meet_actions

 * @note Авторизация требуется от аккаунта: @p coopname
 */
void meet::signbysecr(name coopname, name username, checksum256 hash, document2 secretary_decision) {
    require_auth(coopname);

    // 1. Находим собрание по хэшу
    auto meet_opt = get_meet(coopname, hash);
    eosio::check(meet_opt.has_value(), "Собрание не найдено");
    auto meet_record = meet_opt.value();

    eosio::check(username == meet_record.secretary, "Вы не являетесь секретарем собрания");
    eosio::check(meet_record.status == "authorized"_n, "Собрание не находится в статусе 'authorized'");

    // Проверяем, что текущее время > close_at
    auto now = current_time_point();
    
    eosio::check(now.sec_since_epoch() > meet_record.close_at.sec_since_epoch(), 
                 "Собрание ещё не завершено по времени (close_at).");

    // Проверяем, что кворум достигнут
    eosio::check(meet_record.quorum_passed == true, 
                 "Собрание не достигло кворума, не может быть закрыто с успехом.");

    // Проверяем документ
    verify_document_or_fail(secretary_decision, {meet_record.secretary});
    // Протокол подписан ключом самого секретаря собрания.
    verify_signer_keys_or_fail(secretary_decision, meet_record.secretary);

    // Обновляем запись в таблице, сохраняя решение секретаря
    Meet::meets_index genmeets(_meet, coopname.value);
    auto hash_index = genmeets.get_index<"byhash"_n>();
    auto meet_itr = hash_index.find(hash);
    
    eosio::check(meet_itr != hash_index.end(), "Собрание не найдено");
    
    hash_index.modify(meet_itr, RamPayer::of(hash_index, coopname), [&](auto& m) {
        m.decision1 = secretary_decision;
        m.status = "preclosed"_n; // Новый статус после подписи секретарем
    });
    
  

} 