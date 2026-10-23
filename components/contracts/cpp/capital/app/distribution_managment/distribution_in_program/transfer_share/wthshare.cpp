/**
 * @brief Трансляция паевого взноса пайщика из ЦПП «Благорост» в ЦПП
 * «Цифровой Кошелёк» по его заявлению.
 *
 * Паевой взнос в Благорост (вложения в программу и конвертация результатов
 * генерации) лежит на кошельке программы пайщика `w.cap.blago`. Вернуть
 * паевой взнос деньгами можно только с Цифрового Кошелька, поэтому пайщик
 * переводит туда весь остаток или его часть своим заявлением (шаблон 1090), а
 * возврат оформляет уже штатным заявлением о возврате паевого взноса. Зеркало
 * `edubridge::wthshare`.
 *
 * Кому открыта трансляция, решает кооператив: заявление отправляет сервер
 * ключом кооператива только для пайщиков, которым председатель выдал доступ.
 * Совет заявление не рассматривает — процесс одноактовый, в отличие от
 * `createwthd3` (возврат начислений программы через совет).
 *
 * Одна ledger2-операция:
 *  - `o.cap.wthcap` (TRANSFER w.cap.blago → w.wal.share, без проводки — оба
 *    кошелька на счёте 80).
 *
 * Перед списанием фиксируются начисления членских взносов программы на
 * прежний остаток (`refresh_contributor_program_rewards`): доля пайщика в
 * распределении считается от остатка кошелька, и уменьшенный остаток не
 * должен съесть уже заработанное. До настройки программы распределений не
 * было, и фиксация пропускается.
 *
 * Записи в RAM нет: заявление исполняется сразу и публикуется в реестр
 * документов; хэш заявления — хэш процесса (процесс из одного действия).
 *
 * Guards:
 *  - заявление подписано пайщиком его ключом; пайщик — действующий член;
 *  - сумма положительна и не больше остатка кошелька программы.
 *
 * @param coopname  Наименование кооператива
 * @param username  Пайщик, чей взнос транслируется
 * @param amount    Сумма трансляции, которую назвал пайщик
 * @param statement Заявление о трансляции паевого взноса (1090)
 * @ingroup public_actions
 * @ingroup public_capital_actions
 *
 * @note Авторизация требуется от аккаунта: @p coopname
 */
void capital::wthshare(eosio::name coopname, eosio::name username, eosio::asset amount, document2 statement) {
  require_auth(coopname);

  eosio::check(amount.is_valid() && amount.amount > 0 && amount.symbol == _root_govern_symbol,
               "CAPITAL_SHARE_AMOUNT_INVALID: Сумма трансляции паевого взноса указывается в символе кооператива и больше нуля");
  eosio::check(!is_empty_document(statement),
               "CAPITAL_SHARE_STATEMENT_REQUIRED: Отсутствует заявление о трансляции паевого взноса");
  verify_document_or_fail(statement, { username });
  // Заявление подписывает сам пайщик. Транзакцию шлёт кооператив, поэтому ключ сверяется с аккаунтом.
  verify_signer_keys_or_fail(statement, username);

  get_participant_or_fail(coopname, username);

  eosio::asset share_balance = Capital::Core::get_capital_program_user_share_balance(coopname, username);
  eosio::check(share_balance >= amount,
               std::string{"CAPITAL_SHARE_INSUFFICIENT: Паевого взноса по программе недостаточно: на кошельке "} +
                 share_balance.to_string() + ", указано " + amount.to_string());

  // Пайщика могли импортировать до настройки программы: тогда распределений
  // не было и фиксировать нечего.
  if (Capital::State::has_global_state(coopname))
    Capital::Core::refresh_contributor_program_rewards(coopname, username);

  Ledger2::apply(_capital, coopname, operations::capital::WITHDRAW_FROM_CAPITAL,
                 processes::capital::WTHCAP,
                 amount, username, statement.hash,
                 Capital::Memo::get_share_transfer_memo());

  Soviet::make_complete_document(_capital, coopname, username, Names::Capital::TRANSFER_SHARE,
                                 statement.hash, statement);
}
