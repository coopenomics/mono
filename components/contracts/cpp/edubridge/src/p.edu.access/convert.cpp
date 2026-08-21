/**
 * @brief Конвертация паевого взноса пайщика в членский взнос ЦПП «Образование».
 *
 * Доступ к курсу оплачивается членским взносом программы. Этот action —
 * единственный путь пополнения членского кошелька программы: пайщик подаёт
 * Заявление о конвертации (шаблон 3011) с просьбой транслировать паевой взнос
 * с программы «Цифровой кошелёк» в программу «Образование». Зеркало
 * `marketplace::convert`.
 *
 * Одна ledger2-операция:
 *  - `o.edu.conv` (TRANSFER w.wal.share → w.edu.member, Дт 80 / Кт 86) —
 *    паевой переходит в целевое финансирование на членский кошелёк программы.
 *
 * Guards:
 *  - amount > 0 в _root_govern_symbol; подпись Заявления валидна (username).
 *  - Пайщик — активный член кооператива.
 *  - w.wal.share.available пайщика >= amount.
 *
 * @ingroup public_edubridge_actions
 */
void edubridge::convert(eosio::name coopname,
                        eosio::name username,
                        eosio::asset amount,
                        document2 statement) {
  require_auth(coopname);

  // ── Валидация параметров и подписи Заявления ────────────────────────
  Edubridge::check_money(amount, "Сумма конвертации");
  eosio::check(!is_empty_document(statement),
               "Отсутствует заявление о конвертации паевого взноса");
  verify_document_or_fail(statement, { username });

  // Пайщик — активный член кооператива (бросает если не найден / blocked)
  get_participant_or_fail(coopname, username);

  // ── Достаточность паевого: w.wal.share.available >= amount ───────────
  auto bal_share = Edubridge::get_user_wallet_balance(
      coopname, ledger2_wallets::SHARE_FUND_PAY, username);
  eosio::check(bal_share.available >= amount,
               std::string{"Недостаточно паевых средств для конвертации: требуется "} +
                 amount.to_string() + ", доступно " + bal_share.available.to_string());

  // ── o.edu.conv: TRANSFER w.wal.share → w.edu.member (Дт 80 / Кт 86) ──
  Ledger2::apply(_edubridge, coopname,
                 operations::edubridge::CONVERT_TO_EDU_MEMBER,
                 processes::edubridge::ACCESS,
                 amount, username, statement.hash,
                 Edubridge::Memo::get_convert_to_member_memo());

  // Заявление о конвертации публикуется в реестр документов отдельным
  // самостоятельным пакетом (package = hash самого заявления).
  Soviet::make_complete_document(_edubridge, coopname, username,
                                 "convert"_n,
                                 statement.hash, statement);
}
