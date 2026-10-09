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
 * Операция идёт под хэшем подписки (`sub_hash`) — тем же, что взнос и
 * удержание в `chargefee`: в реестре процессов доступ к курсу один.
 *
 * Guards:
 *  - amount > 0 в _root_govern_symbol; Заявление подписано ключом самого пайщика.
 *  - Пайщик — активный член кооператива.
 *  - w.wal.share.available пайщика >= amount.
 *
 * @ingroup public_edubridge_actions
 */
void edubridge::convert(eosio::name coopname,
                        eosio::name username,
                        checksum256 sub_hash,
                        eosio::asset amount,
                        document2 statement) {
  require_auth(coopname);

  // ── Валидация параметров и подписи Заявления ────────────────────────
  Edubridge::check_money(amount, "Сумма конвертации");
  eosio::check(!is_empty_document(statement),
               "EDUBRIDGE_CONVERT_STATEMENT_REQUIRED: Отсутствует заявление о конвертации паевого взноса");
  verify_document_or_fail(statement, { username });
  verify_signer_keys_or_fail(statement, username);

  // Пайщик — активный член кооператива (бросает если не найден / blocked)
  get_participant_or_fail(coopname, username);

  // ── Достаточность паевого: w.wal.share.available >= amount ───────────
  auto bal_share = Edubridge::get_user_wallet_balance(
      coopname, ledger2_wallets::SHARE_FUND_PAY, username);
  eosio::check(bal_share.available >= amount,
               std::string{"EDUBRIDGE_SHARE_FUNDS_INSUFFICIENT: Недостаточно паевых средств для конвертации: требуется "} +
                 amount.to_string() + ", доступно " + bal_share.available.to_string());

  // ── o.edu.conv: TRANSFER w.wal.share → w.edu.member (Дт 80 / Кт 86) ──
  Ledger2::apply(_edubridge, coopname,
                 operations::edubridge::CONVERT_TO_EDU_MEMBER,
                 processes::edubridge::ACCESS,
                 amount, username, sub_hash,
                 Edubridge::Memo::get_convert_to_member_memo());

  // Заявление о конвертации публикуется в реестр документов пакетом процесса
  // подписки (package = sub_hash): конвертация, взнос и удержание — один процесс.
  Soviet::make_complete_document(_edubridge, coopname, username,
                                 "convert"_n,
                                 sub_hash, statement);
}
