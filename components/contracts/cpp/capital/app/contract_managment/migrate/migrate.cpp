/**
 * @brief Миграция контракта capital — восстановление инварианта сумм голосования
 *        у проекта, поставленного на голосование до исправления расчёта.
 *
 * Контекст: calculate_voting_amounts считал equal_voting_amount независимым
 * делением пула на число голосующих и добавлял к нему весь остаток от деления.
 * При остатке >= 2 сумма active_voting_amount + equal_voting_amount выходила
 * больше total_voting_pool, и submitvote отбивал любой голос проверкой
 * «(Общая сумма голосов + Равная не голосующая сумма) должны равняться сумме
 * на распределении». Расчёт исправлен, но у проекта, уже стоящего на
 * голосовании, суммы записаны в таблицу, а пересчитать их нечем: пересчёт
 * живёт в startvoting, который требует статус active, а обратного перехода из
 * voting в active в контракте нет.
 *
 * Действие: у проекта kBrokenVotingProjectId в кооперативе
 * kBrokenVotingCoopname привести equal_voting_amount к остатку пула после
 * активной части — ровно то, что теперь считает calculate_voting_amounts.
 * Остальные поля сумм верны и не трогаются.
 *
 * Идемпотентно: повторный вызов после успешного прогона — no-op (пишем только
 * при расхождении). На окружениях, где такого проекта нет, — no-op.
 * Вызывается автоматически при деплое (playbooks/contracts/deploy-contract.yml).
 *
 * Прежняя миграция (total_debt_amount в capital::projects) проведена на всех
 * окружениях и удалена: действие миграции несёт только незакрытый переход,
 * иначе оно копит уже отработавший код.
 *
 * @ingroup public_actions
 * @ingroup public_capital_actions
 *
 * @note Авторизация требуется от аккаунта: @p _capital
 */
void capital::migrate() {
  require_auth(_capital);

  // Проект «Системный логотип v1»: пул 8128.8320 RUB на 3 голосующих, остаток
  // от деления — 2, поэтому equal был записан на 0.0001 RUB больше нужного.
  static const eosio::name kBrokenVotingCoopname = "voskhod"_n;
  static const uint64_t kBrokenVotingProjectId = 12;

  Capital::project_index projects(_capital, kBrokenVotingCoopname.value);

  auto project_itr = projects.find(kBrokenVotingProjectId);
  if (project_itr == projects.end()) {
    return;
  }

  const eosio::asset expected_equal =
    project_itr->voting.amounts.total_voting_pool - project_itr->voting.amounts.active_voting_amount;

  if (project_itr->voting.amounts.equal_voting_amount == expected_equal) {
    return;
  }

  projects.modify(project_itr, _capital, [&](auto &p) {
    p.voting.amounts.equal_voting_amount = expected_equal;
  });
}
