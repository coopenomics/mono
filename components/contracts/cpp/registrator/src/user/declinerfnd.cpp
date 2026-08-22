/**
 * @brief Отклонение возврата регистрационного взноса — НЕДОПУСТИМО.
 * Возврат полученного регистрационного взноса при отказе совета не может быть
 * отменён: средства кандидата обязаны быть ему возвращены. Действие существует
 * только как обязательный decline-коллбэк gateway (createoutpay требует имя
 * decline-действия) и всегда завершается ошибкой. На фронте кнопки отклонения
 * возврата нет; этот страж защищает от прямого вызова gateway::outdecline.
 * @param coopname Наименование кооператива
 * @param registration_hash Хэш регистрации (= outcome_hash исходящего платежа)
 * @param reason Причина отклонения (игнорируется)
 * @ingroup public_actions
 * @ingroup public_registrator_actions

 * @note Авторизация требуется от аккаунта: @p gateway
 */
void registrator::declinerfnd(name coopname, checksum256 registration_hash, std::string reason) {
  require_auth(_gateway);
  eosio::check(false, "Отмена возврата регистрационного взноса невозможна");
}
