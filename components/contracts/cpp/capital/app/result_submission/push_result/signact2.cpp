/**
 * @brief Подписывает акт 2 по результату участника
 * Подписывает второй акт председателем и завершает процесс принятия результата:
 * - Проверяет что подписывает председатель
 * - Валидирует статус результата (должен быть act1) и статус сегмента (должен быть act1)
 * - Проверяет подлинность документа акта от председателя и участника
 * - Устанавливает второй акт
 * - Начисляет заблокированные средства и обновляет учёт
 * - Обновляет статус сегмента на contributed
 * - Обновляет статус результата на act2
 * - Удаляет объект результата после успешного принятия
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
 
  // Начисляем заблокированные средства в кошелек программы генерации
  if (segment.available_for_program.amount > 0) {
    Wallet::add_blocked_funds(_capital, coopname, result -> username, segment.available_for_program, _source_program, memo);

    // Увеличиваем паевой фонд за счёт результата участника через ledger2 (ISSUE в SHARE_FUND)
    Ledger2::apply(_capital, coopname, ledger2_ops::ACT2_SHARE, segment.available_for_program, result -> username, result_hash, memo);
  }

  // Уменьшаем сумму выданных ссуд кооператива (TRANSFER LONG_TERM_LOANS → DEBT_CLOSED_SINK)
  if (result -> debt_amount.amount > 0){
    Ledger2::apply(_capital, coopname, ledger2_ops::ACT2_LOAN, result -> debt_amount, result -> username, result_hash, memo);
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

  // Изменяем статус результата на act2 перед удалением
  Capital::Results::update_result_status(coopname, result -> id, Capital::Results::Status::ACT2);

  // Удаляем объект результата после успешного принятия
  Capital::Results::delete_result(coopname, result -> id);
};