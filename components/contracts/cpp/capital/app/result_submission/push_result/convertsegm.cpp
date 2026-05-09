/**
 * @brief Конвертация сегмента — финальная фаза процесса внесения РИД (`p.cap.rid`).
 *
 * Внесение РИД состоит из трёх ончейн-фаз, объединённых одним `result_hash`:
 *   1. `pushrslt`   — заявление + закрытие долга (статус `STATEMENT`/`ACT1`).
 *   2. `signact2`   — председатель подписывает акт-2: ACCEPT_RID (Dr 04 / Cr 08),
 *                     REPAY (если был долг). Сегмент → `CONTRIBUTED`, результат → `ACT2`.
 *   3. `convertsegm` (этот action) — пайщик распределяет накопленный
 *                     `available_for_program` между ЦК (SHARE_FUND_PAY) и
 *                     ЦПП «Благорост» (BLAGOROST_FUND), кошельковое движение
 *                     уже без бухпроводок (Dr/Cr закрыто в ACCEPT_RID).
 *                     После конвертации сегмент удаляется, результат удаляется.
 *
 * Семантика проверок:
 * - сегмент в статусе `CONTRIBUTED`, актуален (rfrshsegment);
 * - долг к моменту конвертации погашен;
 * - суммы конвертации соответствуют долям сегмента (см. eosio::check ниже);
 * - объект результата всё ещё существует и в статусе `ACT2` (анкер процесса).
 *
 * @param coopname Наименование кооператива
 * @param username Наименование пользователя-участника
 * @param project_hash Хеш проекта
 * @param result_hash Хеш результата (анкер процесса `p.cap.rid`)
 * @param wallet_amount Сумма для конвертации в кошелек
 * @param capital_amount Сумма для конвертации в капитал
 * @param convert_statement Заявление о конвертации
 * @ingroup public_actions
 * @ingroup public_capital_actions
 * @note Авторизация требуется от аккаунта: @p coopname
 */
void capital::convertsegm(eosio::name coopname, eosio::name username,
                          checksum256 project_hash, checksum256 result_hash,
                          eosio::asset wallet_amount, eosio::asset capital_amount,
                          document2 convert_statement) {
  require_auth(coopname);

  // Получаем сегмент пайщика
  auto segment = Capital::Segments::get_segment_or_fail(coopname, project_hash, username,
                                                      "Сегмент пайщика не найден");

  // Определяем целевой проект для конвертации
  auto current_project = Capital::Projects::get_project_or_fail(coopname, project_hash);

  // Объект результата живёт от pushrslt до convertsegm (анкер процесса).
  auto result = Capital::Results::get_result(coopname, result_hash);
  eosio::check(result.has_value(), "Объект результата не найден по result_hash");
  eosio::check(result->project_hash == project_hash, "result_hash не принадлежит указанному проекту");
  eosio::check(result->username == username, "result_hash не принадлежит указанному пользователю");
  eosio::check(result->status == Capital::Results::Status::ACT2,
               "Неверный статус результата. Ожидается 'act2' (после signact2)");

  // Участники с интеллектуальными ролями должны сначала внести результат
  eosio::check(segment.status == Capital::Segments::Status::CONTRIBUTED,
               "Результат не внесён. Сначала внесите результат через pushrslt → signact2");

  // Проверяем актуальность сегмента (включая синхронизацию с инвестициями)
  Capital::Core::check_segment_is_updated(coopname, current_project, segment, "Сегмент не обновлен. Выполните rfrshsegment перед конвертацией");

  // === ФАЗА 1: БАЗОВЫЕ ПРОВЕРКИ ===
  Wallet::validate_asset(wallet_amount);
  Wallet::validate_asset(capital_amount);

  // Доступная сумма для конвертации в кошелек (только из интеллектуальных вкладов)
  eosio::asset available_for_wallet = segment.provisional_amount - segment.debt_amount;
  eosio::check(wallet_amount <= available_for_wallet, "Сумма конвертации в кошелек превышает доступную и обеспеченную суммы. Для конвертации доступна обеспеченная сумма за вычетом суммы выданных ссуд (provisional_amount - debt_amount)");

  // Доступная сумма для конвертации в программу
  eosio::asset available_for_program = segment.available_for_program;

  // === ФАЗА 2: ВАЛИДАЦИЯ С СЕГМЕНТОМ ===

  // Проверяем что общая сумма конвертации (кошелек + капитал) не превышает интеллектуальную стоимость сегмента
  eosio::asset total_convert = wallet_amount + capital_amount;
  eosio::check(total_convert <= segment.intellectual_cost,
               "Общая сумма конвертации (" + total_convert.to_string() + ") не может превышать интеллектуальную стоимость сегмента (" + segment.intellectual_cost.to_string() + ")");

  // Проверяем что общая сумма конвертации (кошелек + капитал) вместе с долгом равна интеллектуальной стоимости
  // Это критическая проверка: мы должны списать ровно столько, сколько заблокировано в _source_program
  eosio::check(total_convert + segment.debt_amount == segment.intellectual_cost,
               "Сумма конвертации (" + total_convert.to_string() + ") и долга (" + segment.debt_amount.to_string() + ") должна быть равна интеллектуальной стоимости сегмента (" + segment.intellectual_cost.to_string() + ")");

  eosio::check(total_convert == available_for_program, "Общая сумма конвертации должна равняться доступной сумме (intellectual_cost - debt_amount). Передано: " + total_convert.to_string() + ", Ожидается: " + available_for_program.to_string());

  eosio::check(capital_amount <= available_for_program, "Сумма конвертации в программу превышает сумму себестоимости и премий за вычетом суммы выданных ссуд");
  eosio::check(capital_amount == (available_for_program - wallet_amount), "В программу должно быть сконвертировано всё доступное, что не конвертируется в кошелёк");


  // Конвертация сегмента после ACT2: GENERATOR_FUND расщепляется на две цели —
  // часть пайщику деньгами в ЦК, часть в Благорост-капитал. Бухпроводка Dr 04 / Cr 08
  // уже сделана в signact2 (ACCEPT_RID, WalletOp::NONE) на полный available_for_program;
  // здесь только кошельковые TRANSFER без проводок.
  // Σ wallet_amount + capital_amount == available_for_program (проверено выше).
  if (wallet_amount.amount > 0) {
    Ledger2::apply(_capital, coopname, operations::capital::CONVERT_TO_SHARE,
                   wallet_amount, username, result_hash,
                   Capital::Memo::get_convert_segment_to_wallet_memo(result_hash));

    // Учитываем использование инвестиций для компенсации
    Capital::Projects::add_used_for_compensation(coopname, current_project.id, wallet_amount);
  }

  if (capital_amount.amount > 0) {
    Ledger2::apply(_capital, coopname, operations::capital::CONVERT_TO_BLAGO,
                   capital_amount, username, result_hash,
                   Capital::Memo::get_convert_segment_to_capital_memo(result_hash));
  }

  // Инкрементируем счётчик сконвертированных сегментов
  Capital::Projects::increment_converted_segments(coopname, current_project.id);

  // Удаляем сегмент после конвертации
  Capital::Segments::remove_segment(coopname, segment.id);

  // Удаляем объект результата — конвертация завершает процесс p.cap.rid.
  // До этого момента result жил со статусом ACT2 как анкер процесса.
  Capital::Results::delete_result(coopname, result->id);

}

// Конвертация реализована с учетом того что investor_base уже в _capital_program:
// - В кошелек: provisional_amount - debt_amount, не больше available_for_wallet
// - В благорост: все взносы минус долг минус кошелек (investor_base уже там)
// - total_segment_available = total_segment_cost - debt_amount (долг уже погашен в pushrslt)
// - Долг погашается только за счет базовых сумм создателя/автора/координатора
