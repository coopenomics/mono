using namespace eosio;

/**
 * @brief Конвертация паевого взноса пайщика в членский на биллинг-кошелёк.
 *
 * Пайщик подаёт подписанное заявление (document2) «прошу транслировать мой
 * паевой взнос в членский за использование инфраструктуры». Контракт одним
 * движением ledger2 (`o.bil.fund`) переводит средства с паевого кошелька
 * `w.wal.share` на персональный биллинг-кошелёк `w.wal.bill` (Dr 80 / Cr 86):
 * паевой взнос (возвратный) превращается в членский (целевой, невозвратный),
 * зарезервированный под оплату подписок. Сам факт конвертации трактуется как
 * согласие пайщика на последующие рекуррентные списания (см. `pay`).
 *
 * @param coopname     Кооператив-плательщик (его подписью релеит бэкенд после JWT).
 * @param username     Пайщик, чей паевой конвертируется.
 * @param amount       Сумма конвертации (RUB, > 0).
 * @param convert_hash Детерминированный sha256-якорь процесса конвертации
 *                     (coopname, username, amount, anchor). Используется как
 *                     process_hash ledger2-операции и как package_hash в
 *                     Soviet::make_complete_document — по нему документ
 *                     находится в реестре кооператива. Обеспечивает связность
 *                     процесса и идемпотентность на уровне soviet-реестра.
 * @param document     Подписанное пайщиком заявление (обязательно, непустой hash).
 *
 * @ingroup public_billing_actions
 * @note Авторизация требуется от аккаунта: @p coopname
 */
void billing::convert(name coopname, name username, asset amount,
                      checksum256 convert_hash, document2 document) {
  require_auth(coopname);

  // Плательщик должен быть кооперативом (presence-only, без статуса).
  Billing::assert_payer_is_cooperative(coopname);

  check(amount.is_valid() && amount.amount > 0, "Сумма конвертации должна быть положительной");
  check(amount.symbol == _root_govern_symbol, "Неверный символ валюты для конвертации");
  check(convert_hash != checksum256{}, "convert_hash обязателен (детерминированный якорь процесса)");

  // Заявление обязательно и должно быть подписано пайщиком. Ловушка: пустой
  // checksum256 ломает ABI-кодирование/верификацию — документ должен быть реальным.
  check(!is_empty_document(document), "Заявление на конвертацию обязательно (пустой документ недопустим)");
  verify_document_or_fail(document, std::vector<name>{username});

  const std::string memo =
      "Трансляция паевого взноса в членский на биллинг-кошелёк, пайщик=" + username.to_string();

  Ledger2::apply(
    _billing,
    coopname,
    operations::billing::CONVERT,
    amount,
    username,
    convert_hash,
    memo
  );

  // Фиксируем заявление в общем реестре документов кооператива (newsubmitted +
  // newresolved в soviet — как в registrator::regcoop / capital::createpinv /
  // soviet::converttoaxn). package_hash = convert_hash — документ привязан к
  // конкретному процессу конвертации; повтор с тем же convert_hash на уровне
  // soviet-реестра идемпотентен.
  Soviet::make_complete_document(
    _billing,
    coopname,
    username,
    "convert"_n,
    convert_hash,
    document
  );
}
