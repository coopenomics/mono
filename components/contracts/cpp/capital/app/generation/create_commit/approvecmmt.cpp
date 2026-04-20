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
  eosio::asset old_available_for_program = eosio::asset(0, _root_govern_symbol);
  if (segment.has_value()) {
    segment_id = segment.value().id;
    old_available_for_program = segment.value().available_for_program;
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
  // имуществом на долю этого коммита. Схема Matrix 2026-04-19: «собирать
  // на 08 частями по мере коммитов, переносить на 04 когда РИД собран»
  // (Ангелина). Ранее COMMIT_RID вызывался атомарно в signact2 вместе
  // с ACCEPT_RID — по ревью 2026-04-20 разделён.
  //
  // Сумма — дельта segment.available_for_program = intellectual_cost − debt_amount.
  // Это доля одобренного коммита, которая пойдёт в НМА после acceptance.
  // Инвариант: Σ COMMIT_RID по сегменту == segment.available_for_program
  // на момент signact2 → ACCEPT_RID закрывает 08 в ноль.
  //
  // process_hash = project_hash (а не commit_hash), т.к. commit-entity
  // удаляется ниже, а project_hash — долгоживущий якорь, под которым
  // UI группирует все коммиты проекта в один process `cap.apprvcmmt`.
  auto updated_segment = Capital::Segments::get_segment_or_fail(coopname, commit.project_hash, commit.username, "Сегмент после upsert не найден");
  eosio::asset delta_available = updated_segment.available_for_program - old_available_for_program;
  eosio::check(delta_available.amount >= 0, "Отрицательная дельта available_for_program при COMMIT_RID");
  if (delta_available.amount > 0) {
    auto contributor = Capital::Contributors::get_active_contributor_or_fail(coopname, commit.username);
    auto memo = Capital::Memo::get_push_result_memo(contributor -> id);
    Ledger2::apply(_capital, coopname, ledger2_ops::COMMIT_RID, delta_available, commit.username, commit.project_hash, memo);
  }

  // Удаляем коммит после обработки
  Capital::Commits::delete_commit(coopname, commit.id);
};
