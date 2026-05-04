/**
 * @brief Одобряет коммит в проект
 * Одобряет коммит от мастера проекта и обрабатывает все связанные операции:
 * - Проверяет что одобрение идет от мастера проекта
 * - Получает коммит
 * - Обновляет или создает сегмент создателя
 * - Распределяет авторские средства между всеми авторами проекта
 * - Удаляет коммит после обработки
 * @param coopname Наименование кооператива
 * @param username Наименование пользователя, одобрившего коммит
 * @param master Мастер проекта, одобряющий коммит
 * @param commit_hash Хеш коммита для одобрения
 * @ingroup public_actions
 * @ingroup public_capital_actions
 * @note Авторизация требуется от аккаунта: @p coopname
 */
void capital::approvecmmt(eosio::name coopname, eosio::name master, checksum256 commit_hash) {
  require_auth(coopname);

  // Получаем коммит
  auto commit = Capital::Commits::get_commit_or_fail(coopname, commit_hash);

  // Получаем проект и проверяем что мастер является мастером этого проекта
  auto project = Capital::Projects::get_project_or_fail(coopname, commit.project_hash);
  eosio::check(project.master == master, "Только мастер проекта может одобрять коммиты");

  // Добавляем коммит к проекту
  Capital::Projects::add_commit(coopname, project.id, commit.amounts);

  // Получаем или создаем segment_id для создателя
  auto segment = Capital::Segments::get_segment(coopname, commit.project_hash, commit.username);
  uint64_t segment_id = 0;
  if (segment.has_value()) {
    segment_id = segment.value().id;
  } else {
    segment_id = Capital::Segments::get_segment_id(coopname);
  }

  // Обновляем или создаем сегмент создателя
  Capital::Core::upsert_creator_segment(coopname, segment_id, project, commit.username, commit.amounts);

  // Распределяем авторские средства между всеми авторами проекта
  Capital::Core::increment_authors_crps_in_project(coopname, project.id,
                                   commit.amounts.authors_base_pool,
                                   commit.amounts.authors_bonus_pool);

  // Распределяем премии участников между всеми участниками проекта через CRPS
  Capital::Core::increment_contributors_crps_in_project(coopname, project.id, commit.amounts.contributors_bonus_pool);

  // Коммит РИД (Dr 08 / Cr 80) — возникает обязательство паевого взноса
  // имуществом на полную стоимость одобренного коммита.
  //
  // На GENERATOR_COMMIT (10001) кладём ПОЛНУЮ стоимость коммита
  // `commit.amounts.total_contribution` — это сумма всех начислений по
  // коммиту, включая base/bonus создателей, base/bonus авторов, бонусы
  // участников. Эта же сумма в сумме по всем коммитам проекта равна
  // project.fact.total_contribution = sum(intellectual_cost) всех сегментов.
  //
  // Так signact2 (ACCEPT_RID) спокойно забирает с 10001 каждое
  // segment.available_for_program — независимо от того, как голосование
  // перераспределило бонусы между сегментами: общая сумма не меняется.
  // Инвариант: Σ COMMIT_RID(коммитов проекта) == Σ ACCEPT_RID(сегментов проекта)
  // → GENERATOR_COMMIT закрывается в ноль на проекте, не на сегменте.
  //
  // process_hash = project_hash (а не commit_hash), т.к. commit-entity
  // удаляется ниже, а project_hash — долгоживущий якорь, под которым
  // UI группирует все коммиты проекта в один process `cap.apprvcmmt`.
  if (commit.amounts.total_contribution.amount > 0) {
    auto contributor = Capital::Contributors::get_active_contributor_or_fail(coopname, commit.username);
    auto memo = Capital::Memo::get_push_result_memo(contributor -> id);
    Ledger2::apply(_capital, coopname, operations::capital::COMMIT_RID, commit.amounts.total_contribution, commit.username, commit.project_hash, memo);
  }

  // Удаляем коммит после обработки
  Capital::Commits::delete_commit(coopname, commit.id);
};
