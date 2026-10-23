/**
 * @brief Очистка отработавших записей Благороста (lib/core/cleanup.hpp).
 *
 * Правила, по кооперативам:
 * - `votes` — голоса проекта, который финализирован или удалён. Голоса читает
 *   только расчёт премии (calcvotes), он требует статус result; из finalized
 *   проект назад не возвращается. Новые голоса удаляются сами при финализации
 *   и удалении проекта, правило подметает накопленные раньше.
 * - `commits` — коммит удалённого проекта. Одобрить и отклонить его нельзя:
 *   оба действия требуют существующий проект, а новый проект с тем же хешем
 *   принял бы чужой коммит.
 *
 * Проекты, сегменты и участников не трогаем: контроллер показывает проект и
 * пускает участника, пока строка есть в цепи.
 *
 * @note Авторизация требуется от аккаунта: @p capital
 */
void capital::cleanup() {
  require_auth(_capital);
  Cleanup::budget budget;

  for (const auto &coopname : Core::Registrator::get_cooperative_names()) {
    if (budget.exhausted()) break;

    Capital::project_index projects(_capital, coopname.value);
    auto by_hash = projects.get_index<"byhash"_n>();

    // Строка проекта тяжёлая, поэтому её статус читается один раз на хеш,
    // а не на каждый голос.
    std::map<checksum256, eosio::name> project_status;
    const eosio::name missing{};
    auto status_of = [&](const checksum256 &hash) {
      auto cached = project_status.find(hash);
      if (cached != project_status.end()) return cached->second;
      auto project = by_hash.find(hash);
      const eosio::name status = project == by_hash.end() ? missing : project->status;
      project_status.emplace(hash, status);
      return status;
    };

    Capital::votes_index votes(_capital, coopname.value);
    Cleanup::erase_where(votes, budget, [&](const auto &vote) {
      const eosio::name status = status_of(vote.project_hash);
      return status == missing || status == Capital::Projects::Status::FINALIZED;
    });

    Capital::Commits::commit_index commits(_capital, coopname.value);
    Cleanup::erase_where(commits, budget, [&](const auto &commit) {
      return status_of(commit.project_hash) == missing;
    });
  }

  Cleanup::report(_capital, budget);
}
