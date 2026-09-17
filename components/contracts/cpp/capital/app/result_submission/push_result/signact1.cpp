/**
 * @brief Подписывает акт 1 по результату участника
 * Подписывает первый акт по результату участника:
 * - Проверяет подлинность документа акта от участника
 * - Валидирует статус результата (должен быть authorized) и статус сегмента (должен быть authorized)
 * - Проверяет права участника на подписание акта
 * - Устанавливает первый акт
 * - Обновляет статус результата на act1
 * - Обновляет статус сегмента на act1
 * @param coopname Наименование кооператива
 * @param username Наименование пользователя-участника
 * @param result_hash Хеш результата
 * @param act Документ акта 1
 * @ingroup public_actions
 * @ingroup public_capital_actions

 * @note Авторизация требуется от аккаунта: @p coopname
 */
void capital::signact1(eosio::name coopname, eosio::name username, checksum256 result_hash, document2 act) {
  require_auth(coopname);
  
  // Проверяем документ
  verify_document_or_fail(act, {username});
  // Акт подписан ключом аккаунта самого участника. Транзакцию шлёт кооператив, поэтому ключ сверяется с аккаунтом.
  verify_signer_keys_or_fail(act, username);

  // Проверяем результат и права
  auto exist_result = Capital::Results::get_result(coopname, result_hash);
  eosio::check(exist_result.has_value(), "Объект результата не найден");
  eosio::check(exist_result->status == Capital::Results::Status::AUTHORIZED, "Неверный статус. Результат должен быть авторизован советом");
  eosio::check(exist_result->username == username, "Только участник может подписать акт для своего результата");
  
  // Проверяем статус сегмента
  auto segment = Capital::Segments::get_segment_or_fail(coopname, exist_result->project_hash, username, "Сегмент участника не найден");
  eosio::check(segment.status == Capital::Segments::Status::AUTHORIZED, "Неверный статус сегмента. Ожидается статус 'authorized'");

  // Устанавливаем первый акт
  Capital::Results::set_result_act1(coopname, exist_result -> id, act);

  // Линковка акта к пакету результата
  Action::send<newlink_interface>(
    _soviet,
    "newlink"_n,
    _capital,
    coopname,
    exist_result->username,
    Names::Capital::SIGN_ACT1_RESULT,
    result_hash,
    act
  );

  // Обновляем статус результата
  Capital::Results::update_result_status(coopname, exist_result -> id, Capital::Results::Status::ACT1);
  
  // Обновляем статус сегмента
  Capital::Segments::update_segment_status(coopname, exist_result->project_hash, exist_result->username, Capital::Segments::Status::ACT1);
};