/**
 * @brief Создаёт и сразу принимает программную инвестицию
 * В одной транзакции проверяет заявление, списывает сумму с доступного остатка главного кошелька,
 * зачисляет её на кошелёк программы благороста (заблокировано), увеличивает пул доступных программных инвестиций
 * и накопительный показатель инвестора @c contributed_as_investor у контрибьютора.
 * Отдельное одобрение совета (ранее apprvpinv) и отклонение (declpinv) не используются.
 * @param coopname Наименование кооператива
 * @param username Наименование пользователя-инвестора
 * @param invest_hash Хеш программной инвестиции
 * @param amount Сумма инвестиции
 * @param statement Заявление об инвестиции
 * @ingroup public_actions
 * @ingroup public_capital_actions

 * @note Авторизация требуется от аккаунта: @p coopname
 */
void capital::createpinv(name coopname, name username, checksum256 invest_hash, asset amount, document2 statement) {
  require_auth(coopname);
  
  verify_document_or_fail(statement, {username});
  
  // Проверяем сумму инвестиции
  Wallet::validate_asset(amount);
  
  // Проверяем основной договор УХД
  auto contributor = Capital::Contributors::get_active_contributor_or_fail(coopname, username);
  
  // Проверяем наличие кошелька в программе благороста (_capital_wallet)
  eosio::check(Capital::Wallets::has_program_capital_wallet(coopname, username),
               "У пайщика нет кошелька в программе благороста");

  std::string memo = Capital::Memo::get_program_invest_memo(contributor -> id);

  // Как в createinvest: программные инвесторы не проходят через signact2 — фиксируем вклад здесь
  Capital::Contributors::increase_investor_contribution(coopname, contributor -> id, amount);

  // Геймификация: программный инвестор не имеет сегмента, поэтому energy_gain
  // считаем от суммы напрямую (как в createinvest, только без агрегации по
  // ролям сегмента). Без этого вызова уровень/энергия не растут при прямой
  // инвестиции в Благорост.
  {
    auto config = Capital::State::get_global_state(coopname).config;
    double energy_gain = Capital::Gamification::calculate_energy_gain(amount, contributor -> level, config);
    Capital::Gamification::add_energy_and_check_levelup(coopname, contributor -> id, energy_gain);
  }

  // ledger2: TRANSFER w.wal.share → w.cap.blago (без бухпроводки — оба счёта 80).
  // Источник правды UI для балансов кошельков пайщика — L3 ledger2::userwallets.
  Ledger2::apply(_capital, coopname, operations::capital::INVEST, amount,
                 contributor -> username, invest_hash, memo);

  Capital::Core::add_program_investment_funds(coopname, amount);

  // Фиксируем заявление об инвестиции в программу в реестре (как createinvest)
  Soviet::make_complete_document(
    _capital,
    coopname,
    username,
    Names::Capital::CREATE_PROGRAM_INVESTMENT,
    invest_hash,
    statement
  );
}
