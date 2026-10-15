/**
 * @brief Одобряет результат участника председателем
 * Одобряет результат участника и отправляет в совет:
 * - Проверяет подлинность одобренного заявления
 * - Валидирует статус результата (должен быть created) и статус сегмента (должен быть statement)
 * - Устанавливает одобренное заявление
 * - Обновляет статус результата на approved
 * - Обновляет статус сегмента на approved
 * - Отправляет результат в совет
 * @param coopname Наименование кооператива
 * @param username Наименование пользователя, одобрившего результат
 * @param result_hash Хеш результата для одобрения
 * @param approved_statement Одобренное заявление о результате
 * @ingroup public_actions
 * @ingroup public_capital_actions

 * @note Авторизация требуется от контракта совета
 */
void capital::approverslt(eosio::name coopname, eosio::name username, checksum256 result_hash, document2 approved_statement){
  require_auth(_soviet);
  
  // Проверяем заявление
  verify_document_or_fail(approved_statement);
  // Согласие подписано ключом аккаунта одобряющего. Транзакцию шлёт кооператив, поэтому ключ сверяется с аккаунтом.
  verify_signer_keys_or_fail(approved_statement, username);
  
  // Проверяем статус результата
  auto exist_result = Capital::Results::get_result(coopname, result_hash);
  eosio::check(exist_result.has_value(), "Результат пользователя не существует");
  eosio::check(exist_result->status == Capital::Results::Status::CREATED, "Неверный статус результата");
  
  // Проверяем статус сегмента
  auto segment = Capital::Segments::get_segment_or_fail(coopname, exist_result->project_hash, exist_result->username, "Сегмент участника не найден");
  eosio::check(segment.status == Capital::Segments::Status::STATEMENT, "Неверный статус сегмента. Ожидается статус 'statement'");
  
  // Устанавливаем одобренное заявление
  Capital::Results::set_result_approved_statement(coopname, exist_result -> id, approved_statement);
  
  // Обновляем статус результата
  Capital::Results::update_result_status(coopname, exist_result -> id, Capital::Results::Status::APPROVED);
  
  // Обновляем статус сегмента
  Capital::Segments::update_segment_status(coopname, exist_result->project_hash, exist_result->username, Capital::Segments::Status::APPROVED);
  
  // Отправляем в совет
  Capital::Results::send_result_to_soviet(coopname, exist_result->username, result_hash, approved_statement);
};