/**
 * @brief Подписывает акт 2 по результату участника
 * Подписывает второй акт председателем и фиксирует приём РИД в паевой фонд
 * (фаза процесса `p.cap.rid`, после которой пайщик может вызвать convertsegm):
 * - Проверяет что подписывает председатель
 * - Валидирует статус результата (должен быть act1) и статус сегмента (должен быть act1)
 * - Проверяет подлинность документа акта от председателя и участника
 * - Устанавливает второй акт
 * - Начисляет заблокированные средства и обновляет учёт
 * - Обновляет статус сегмента на contributed
 * - Обновляет статус результата на act2 (анкер процесса до convertsegm)
 * @param coopname Наименование кооператива
 * @param username Наименование пользователя-председателя
 * @param result_hash Хеш результата
 * @param act Документ акта 2
 * @ingroup public_actions
 * @ingroup public_capital_actions

 * @note Авторизация требуется от аккаунта: @p coopname
 */
void capital::signact2(eosio::name coopname, eosio::name chairman, checksum256 result_hash, document2 act) {
  require_auth(coopname);

  auto soviet = get_board_by_type_or_fail(coopname, "soviet"_n);
  auto real_chairman = soviet.get_chairman();

  eosio::check(real_chairman == chairman,
               "Только председатель может принять имущество");
  
  // Проверяем результат и права
  auto result = Capital::Results::get_result(coopname, result_hash);
  eosio::check(result.has_value(), "Объект результата не найден");
  eosio::check(result->status == Capital::Results::Status::ACT1, "Неверный статус. Первый акт должен быть подписан");
  
  // Проверяем статус сегмента
  auto segment = Capital::Segments::get_segment_or_fail(coopname, result->project_hash, result->username, "Сегмент участника не найден");
  eosio::check(segment.status == Capital::Segments::Status::ACT1, "Неверный статус сегмента. Ожидается статус 'act1'");
    
  auto contributor = Capital::Contributors::get_active_contributor_or_fail(coopname, result -> username);
  auto memo = Capital::Memo::get_push_result_memo(contributor -> id);

  // Проверяем документ
  verify_document_or_fail(act, { result->username, real_chairman });

  // Устанавливаем второй акт
  Capital::Results::set_result_act2(coopname, result -> id, act);
 
  // Приём результата интеллектуальной деятельности (РИД) в паевой фонд.
  // Схема ревью 2026-04-20 (Ангелина Matrix 2026-04-19): две раздельные проводки
  // в разных action'ах по фазам жизненного цикла РИД.
  //   1) COMMIT_RID (Dr 08 / Cr 80) — теперь в `approvecmmt` на каждом одобрении
  //      мастером конкретного коммита, на дельту `available_for_program`.
  //      «Собираем на 08 частями по мере накопления коммитов».
  //   2) ACCEPT_RID (Dr 04 / Cr 08) — здесь, на полный накопленный
  //      `segment.available_for_program`. «Переносим с 08 на 04 когда РИД
  //      собран и подписан акт-2».
  // Инвариант: Σ COMMIT_RID (по коммитам сегмента) == ACCEPT_RID → GENERATOR_FUND
  // (w.cap.gen) закрывается в ноль, 08-й счёт закрывается в ноль по этому сегменту.
  if (segment.available_for_program.amount > 0) {
    Ledger2::apply(_capital, coopname, operations::capital::ACCEPT_RID, segment.available_for_program, result -> username, result_hash, memo);
  }

  // Возврат беспроцентного займа пайщика: Dr 80 / Cr 58, TRANSFER LOAN_ISSUED → SHARE_FUND_PAY.
  // Семантика: пайщик погасил ссуду результатом (интеллектуальным взносом),
  // у кооперативa уменьшилось фин. вложение 58, деньги вернулись на расчётный.
  if (result -> debt_amount.amount > 0){
    Ledger2::apply(_capital, coopname, operations::capital::REPAY, result -> debt_amount, result -> username, result_hash, memo);
  }
  
  // Обновляем накопительные показатели контрибьютора на основе его ролей в сегменте
  Capital::Contributors::update_contributor_ratings_from_segment(coopname, contributor->id, segment);

  // Линковка акта к пакету результата
  Action::send<newlink_interface>(
    _soviet,
    "newlink"_n,
    _capital,
    coopname,
    result->username,
    Names::Capital::SIGN_ACT2_RESULT,
    result_hash,
    act
  );

  // Обновляем статус сегмента
  Capital::Segments::update_segment_status(coopname, result->project_hash, result->username, Capital::Segments::Status::CONTRIBUTED);

  // Статус результата → ACT2. Объект НЕ удаляется здесь: result_hash остаётся
  // якорем процесса p.cap.rid до convertsegm, который завершает процесс и
  // удаляет result.
  Capital::Results::update_result_status(coopname, result -> id, Capital::Results::Status::ACT2);
};