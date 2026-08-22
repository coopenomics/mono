#include "../../../domain/core/gamification/gamification.hpp"
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
/**
 * @brief Пересчёт уровней по исправленной шкале.
 *
 * Прежнее начисление считалось один раз от требования стартового уровня, а
 * накопленная энергия делилась на сотню линейно — коэффициент роста при
 * перескоке не применялся вовсе. Из-за этого один крупный вклад поднимал на
 * кратно большее число уровней: при базе 10 000 ₽ и коэффициенте 1.5 взнос в
 * миллион давал сотню уровней вместо десяти.
 *
 * Пересчёт прогоняет накопленные вклады участника через исправленную шкалу с
 * нуля: сумма расходуется последовательно, требование каждого пройденного
 * уровня списывается по своей — уже большей — величине. Идемпотентно: повторный
 * прогон приводит к тому же значению и не пишет, если оно уже верное.
 */
static void recalculate_levels(eosio::name coopname) {
  auto state = Capital::State::get_global_state(coopname);
  const auto& config = state.config;

  Capital::contributor_index contributors(_capital, coopname.value);

  for (auto itr = contributors.begin(); itr != contributors.end(); ++itr) {
    // Накопленные вклады по всем ролям: ровно то, за что начислялись уровни.
    const int64_t total_minor =
        itr->contributed_as_investor.amount +
        itr->contributed_as_creator.amount +
        itr->contributed_as_author.amount +
        itr->contributed_as_coordinator.amount +
        itr->contributed_as_contributor.amount +
        itr->contributed_as_propertor.amount;

    // Шкала считается С НУЛЯ: прежние level/energy получены по сломанной
    // формуле и опорой служить не могут.
    const auto progress = Capital::Gamification::apply_contribution_to_levels(
        static_cast<double>(total_minor), 1, 0.0, config);

    const uint32_t new_level = progress.level;
    const double new_energy = progress.energy;

    // Пишем только при расхождении: иначе повторный прогон миграции жёг бы
    // RAM-платежи и историю действий без изменения состояния.
    const bool same_level = itr->level == new_level;
    const bool same_energy = std::fabs(itr->energy - new_energy) < 1e-9;
    if (same_level && same_energy) {
      continue;
    }

    contributors.modify(itr, _capital, [&](auto &c) {
      c.level = new_level;
      c.energy = new_energy;
    });
  }
}

void capital::migrate() {
  require_auth(_capital);

  // Уровни пересчитываются у всех участников кооператива: сломанная формула
  // начисления действовала на всех, кто вносил вклады.
  recalculate_levels("voskhod"_n);

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
