/**
 * Агрегат ссуд проекта и границы деаллокации.
 *
 * Функции живут отдельно от domain/entities/projects.hpp намеренно: они ходят
 * в таблицу segments, а segments.hpp сам ссылается на Capital::project и
 * поэтому обязан включаться ПОСЛЕ него. Положить обход сегментов прямо в
 * projects.hpp нельзя — получается цикл заголовков. Здесь, на уровне core,
 * обе сущности уже объявлены.
 */

namespace Capital::Projects {

  /**
   * @brief Пересчитывает total_debt_amount проекта обходом его сегментов.
   *
   * Поле — производная от segments, поэтому единственный честный способ его
   * получить — сложить debt_amount по индексу byproject. Обход стоит O(n) по
   * числу участников проекта (десятки), поэтому вызывается только в редких
   * точках: migrate, выдача/отклонение ссуды, конвертация сегмента, deallocate.
   *
   * @param coopname Имя кооператива
   * @param project_id ID проекта
   * @return Пересчитанная сумма непогашенных ссуд
   */
  inline eosio::asset sync_total_debt(eosio::name coopname, uint64_t project_id) {
    project_index projects(_capital, coopname.value);
    auto project = projects.find(project_id);
    eosio::check(project != projects.end(), "Проект не найден");

    Capital::Segments::segments_index segments(_capital, coopname.value);
    auto project_index_by_hash = segments.get_index<"byproject"_n>();

    eosio::asset total = eosio::asset(0, _root_govern_symbol);
    auto itr = project_index_by_hash.lower_bound(project->project_hash);
    for (; itr != project_index_by_hash.end() && itr->project_hash == project->project_hash; ++itr) {
      total += itr->debt_amount;
    }

    // Поле материализовано корректно, только если оно есть И символ наш: CDT
    // сериализует пустой binary_extension как value_or(), то есть asset() с
    // пустым символом, — такую запись переписываем, чтобы в таблице не оставалось
    // «0 » вместо «0.0000 RUB». В остальном modify только при расхождении суммы:
    // migrate прогоняет sync по всем проектам сразу, лишние записи стоят CPU.
    const bool materialized = project->total_debt_amount.has_value() &&
                              project->total_debt_amount.value().symbol == _root_govern_symbol;

    if (!materialized || project->total_debt_amount.value() != total) {
      projects.modify(project, _capital, [&](auto &p) {
        p.total_debt_amount = total;
      });
    }

    return total;
  }

  /**
   * @brief Минимальный invest_pool, при котором ни у кого provisional_amount не упадёт ниже долга.
   *
   * provisional_amount пересчитывается в refresh_provisional_amount как
   * base_i * return_base_percent / 100, а сам процент — это invest_pool /
   * work_costs * 100 (с потолком 100). Значит выплата участнику линейна по
   * invest_pool: provisional_i = base_i * invest_pool / work_costs.
   *
   * Инвариант update_segment_total_cost требует provisional_i >= debt_i.
   * Подставляя, получаем invest_pool >= work_costs * max_i(debt_i / base_i).
   * Берём максимум по всем сегментам с ненулевым долгом и округляем вверх,
   * чтобы усечение double->int64 в refresh_provisional_amount не увело нас
   * на квант ниже границы.
   *
   * Участник с долгом, но без трудовой базы, заблокировал бы деаллокацию
   * полностью (его provisional равен нулю при любом invest_pool) — такого
   * состояния createdebt не создаёт, но проверяем явно.
   *
   * @param coopname Имя кооператива
   * @param prj Проект
   * @return Нижняя граница invest_pool (ноль, если ссуд в проекте нет)
   */
  inline eosio::asset calculate_min_invest_pool_for_debts(eosio::name coopname, const project &prj) {
    int64_t work_costs = prj.fact.creators_base_pool.amount +
                         prj.fact.authors_base_pool.amount +
                         prj.fact.coordinators_base_pool.amount;

    if (work_costs == 0) {
      return eosio::asset(0, _root_govern_symbol);
    }

    // Ради этой отсечки поле total_debt_amount и заведено: в проекте без ссуд
    // (типовой случай) граница нулевая и обход сегментов не нужен вовсе.
    // Значение должно быть синхронизировано вызовом sync_total_debt.
    if (debt_ext_or_zero(prj.total_debt_amount).amount == 0) {
      return eosio::asset(0, _root_govern_symbol);
    }

    Capital::Segments::segments_index segments(_capital, coopname.value);
    auto project_index_by_hash = segments.get_index<"byproject"_n>();

    double max_ratio = 0.0;
    auto itr = project_index_by_hash.lower_bound(prj.project_hash);
    for (; itr != project_index_by_hash.end() && itr->project_hash == prj.project_hash; ++itr) {
      if (itr->debt_amount.amount == 0) {
        continue;
      }

      int64_t base = itr->creator_base.amount + itr->author_base.amount + itr->coordinator_base.amount;
      eosio::check(base > 0, "У участника с непогашенной ссудой нет трудовой себестоимости — деаллокация невозможна");

      double ratio = static_cast<double>(itr->debt_amount.amount) / static_cast<double>(base);
      if (ratio > max_ratio) {
        max_ratio = ratio;
      }
    }

    if (max_ratio == 0.0) {
      return eosio::asset(0, _root_govern_symbol);
    }

    // +1 квант — компенсация усечения double->int64 в refresh_provisional_amount
    int64_t min_pool = static_cast<int64_t>(static_cast<double>(work_costs) * max_ratio) + 1;

    return eosio::asset(min_pool, _root_govern_symbol);
  }

  /**
   * @brief Максимальная сумма, которую можно вернуть из проекта в глобальный пул программы.
   *
   * Ограничений три, берём минимум:
   *  1. Возвращаем только программные средства — не больше program_invest_pool.
   *     Прямые инвестиции пайщиков лично им не возвращаются (они уже в «Благоросте»).
   *  2. Нельзя вернуть уже потраченное: total_received минус выплаты участникам
   *     (total_used_for_compensation, туда попадают и выданные ссуды) минус
   *     оплаченные расходы (used_expense_pool).
   *  3. Нельзя опустить invest_pool ниже границы из calculate_min_invest_pool_for_debts,
   *     иначе у заёмщика перестанет обновляться сегмент.
   *
   * @param coopname Имя кооператива
   * @param prj Проект
   * @return Предельная сумма деаллокации (никогда не отрицательная)
   */
  inline eosio::asset calculate_max_deallocatable(eosio::name coopname, const project &prj) {
    int64_t by_program_pool = prj.fact.program_invest_pool.amount;

    int64_t spent = prj.fact.total_used_for_compensation.amount + prj.fact.used_expense_pool.amount;
    int64_t by_unspent = prj.fact.total_received_investments.amount - spent;

    eosio::asset min_invest_pool = calculate_min_invest_pool_for_debts(coopname, prj);
    int64_t by_debts = prj.fact.invest_pool.amount - min_invest_pool.amount;

    int64_t limit = by_program_pool;
    if (by_unspent < limit) limit = by_unspent;
    if (by_debts < limit) limit = by_debts;

    return eosio::asset(limit > 0 ? limit : 0, _root_govern_symbol);
  }

} // namespace Capital::Projects
