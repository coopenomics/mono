/**
 * @brief Конвертация паевого взноса пайщика в членский кошелёк «Стола заказов»
 *        (requirement 76, заказ из остатка из членских средств).
 *
 * Заказ из остатка (`stockorder`) фондируется ВСЕГДА из членского кошелька
 * пайщика начисто. Этот action — отдельный шаг пополнения членского кошелька
 * с паевого: пайщик подаёт Заявление о конвертации (шаблон 1110) с просьбой
 * транслировать паевой взнос с программы «Цифровой кошелёк» в программу
 * «Стол заказов». Зеркало `capital::convertsegm` в Благорост.
 *
 * Одна ledger2-операция:
 *  - `o.mkt.conv` (TRANSFER w.wal.share → w.mkt.member, Дт 80 / Кт 86) —
 *    паевой переходит в целевое финансирование на членский кошелёк программы.
 *
 * Когда вызывается (оркестрация на backend, всё в одной транзакции с `stockorder`):
 *  - докладка у стойки / обычный заказ из остатка, когда членских средств не
 *    хватает: конвертируется вся требуемая сумма;
 *  - замена непоставленного на свободный остаток, когда замена дороже
 *    высвобожденного отменой бюджета: конвертируется только дельта превышения
 *    (в рамках высвобожденного доплаты с паевого нет).
 *
 * Guards:
 *  - amount > 0 в _root_govern_symbol; подпись Заявления валидна (orderer).
 *  - Заказчик — активный пайщик кооператива.
 *  - w.wal.share.available заказчика >= amount.
 *
 * @ingroup public_marketplace_actions
 */
void marketplace::convert(eosio::name coopname,
                          eosio::name orderer,
                          eosio::asset amount,
                          document2 convert_statement) {
  require_auth(coopname);

  // ── Валидация параметров и подписи Заявления ────────────────────────
  eosio::check(amount.is_valid() && amount.amount > 0,
               "Сумма конвертации должна быть больше нуля");
  eosio::check(amount.symbol == _root_govern_symbol,
               "Некорректный символ валюты в сумме конвертации");
  eosio::check(!is_empty_document(convert_statement),
               "Отсутствует заявление о конвертации паевого взноса");
  verify_document_or_fail(convert_statement, { orderer });

  // Заказчик — активный пайщик кооператива (бросает если не найден / blocked)
  get_participant_or_fail(coopname, orderer);

  // ── Достаточность паевого: w.wal.share.available >= amount ───────────
  auto bal_share = Marketplace::get_user_wallet_balance(
      coopname, ledger2_wallets::SHARE_FUND_PAY, orderer);
  eosio::check(bal_share.available >= amount,
               std::string{"Недостаточно паевых средств для конвертации: требуется "} +
                 amount.to_string() + ", доступно " + bal_share.available.to_string());

  // ── o.mkt.conv: TRANSFER w.wal.share → w.mkt.member (Дт 80 / Кт 86) ──
  Ledger2::apply(_marketplace, coopname,
                 operations::marketplace::CONVERT_TO_MKT_MEMBER,
                 processes::marketplace::SUPPLY,
                 amount, orderer, convert_statement.hash,
                 Marketplace::Memo::get_convert_to_member_memo());

  // Заявление о конвертации публикуется в реестр документов отдельным
  // самостоятельным пакетом (package = hash самого заявления).
  Soviet::make_complete_document(_marketplace, coopname, orderer,
                                 "convert"_n,
                                 convert_statement.hash, convert_statement);
}
