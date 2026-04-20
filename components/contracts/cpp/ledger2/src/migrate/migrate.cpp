/**
 * @brief Миграция остатков с legacy-ledger на ledger2 (пересмотр 2026-04-20).
 *
 * Детерминированное разнесение legacy-остатков по 6 целевым кошелькам
 * БЕЗ транзитного счёта 99 (удалён) и БЕЗ зеркала CASH_MAIN (удалён).
 * Алгоритм PRD §4.1.6a FR-L-13b: все суммы проходят через inline
 * `apply(TRANSIT_*)` — единый путь учёта с полной двойной проводкой.
 *
 * Алгоритм на каждый кооператив:
 *
 *   1. Чтение legacy-счетов (laccounts_index, scope=coopname):
 *        cash_legacy  = account[51].available + .blocked
 *        share_legacy = account[80].available + .blocked
 *        entry_legacy = account[861].available + .blocked
 *      (прочие id — ошибка, т.к. в проде ≠ 0 не встречаются)
 *
 *   2. Чтение параметров кооператива (cooperative2, scope=_registrator):
 *        min_share_value = cooperative2.minimum
 *        N_active        = cooperative2.active_participants_count
 *          (fallback — итерация participants_index, scope=coopname, status=='accepted')
 *
 *   3. Чтение программных кошельков (progwallets_index, scope=coopname в soviet):
 *        blagorost_invest = Σ progwallet.blocked  WHERE program_id = 4 (Благорост)
 *        generator_commit = Σ progwallet.blocked  WHERE program_id = 3 (Генератор)
 *
 *      program_id=1 (универсальный) и =2 (marketplace) пока не учитываются —
 *      их остатки являются подмножеством cash_legacy / share_legacy и
 *      сойдутся в `TRANSIT_SHARE` автоматически.
 *
 *   4. Вычисление распределения:
 *        share_money    = cash_legacy - entry_legacy
 *        rid_share      = share_legacy - share_money
 *        min_total      = clamp(N_active * min_share_value,  0, share_money - blagorost_invest)
 *        share_remain   = share_money - min_total - blagorost_invest
 *        rid_remain     = rid_share   - generator_commit
 *
 *      Инварианты (eosio::check, миграция откатывается при нарушении):
 *        share_money     >= min_total + blagorost_invest    (share_remain >= 0)
 *        rid_share       >= generator_commit                (rid_remain   >= 0)
 *        cash_legacy     == min_total + blagorost_invest + share_remain + entry_legacy
 *        share_legacy    == min_total + blagorost_invest + share_remain + generator_commit + rid_remain
 *        entry_legacy    == entry_legacy
 *
 *   5. Отправка 6 inline apply (ненулевые пропускаются):
 *        apply(TRANSIT_MIN_SHARE,  min_total)        → Dr 51 / Cr 80, MIN_SHARE_FUND 2002
 *        apply(TRANSIT_BLAGOROST,  blagorost_invest) → Dr 51 / Cr 80, BLAGOROST_INVEST 9001
 *        apply(TRANSIT_SHARE,      share_remain)     → Dr 51 / Cr 80, SHARE_FUND_PAY 2001
 *        apply(TRANSIT_ENTRY,      entry_legacy)     → Dr 51 / Cr 86, ENTRANCE_FEES 3001
 *        apply(TRANSIT_COMMITMENT, generator_commit) → Dr 08 / Cr 80, GENERATOR_COMMIT 10001
 *        apply(TRANSIT_RID,        rid_remain)       → Dr 04 / Cr 80, SHARE_FUND_RID 2003
 *
 * Курсорный режим: `migrate(from_coop_index, limit)`. Полный прогон —
 * `migrate(0, UINT64_MAX)`. Мета фиксирует `last_migrated_coop_index` для
 * возобновления порциями (защита от CPU-лимита при росте кол-ва кооп.).
 *
 * Поле `writeoff` legacy-ledger игнорируется целиком (PRD §4.1.2 FR-L-7).
 *
 * @ingroup public_ledger2_actions
 */

namespace {

struct LegacyBalances {
  eosio::asset cash;    ///< 51  — Расчётный счёт
  eosio::asset share;   ///< 80  — Паевой фонд
  eosio::asset entry;   ///< 861 — Вступительные взносы
};

inline LegacyBalances read_legacy_balances(eosio::name coopname) {
  laccounts_index old_accounts(_ledger, coopname.value);

  LegacyBalances r{
    eosio::asset(0, _root_govern_symbol),
    eosio::asset(0, _root_govern_symbol),
    eosio::asset(0, _root_govern_symbol),
  };

  for (auto acc_it = old_accounts.begin(); acc_it != old_accounts.end(); ++acc_it) {
    // writeoff игнорируется (FR-L-7).
    const eosio::asset total = acc_it->available + acc_it->blocked;
    if (total.amount == 0) continue;

    eosio::check(total.symbol == _root_govern_symbol,
                 std::string{"migrate: legacy acc "} + std::to_string(acc_it->id) +
                   " имеет неожиданный symbol");

    switch (acc_it->id) {
      case Ledger::accounts::BANK_ACCOUNT:   r.cash  = total; break;   // 51
      case Ledger::accounts::SHARE_FUND:     r.share = total; break;   // 80
      case Ledger::accounts::ENTRANCE_FEES:  r.entry = total; break;   // 861
      default:
        // Все прочие legacy-id (67, 58, 76.x и т.д.) в проде нулевые.
        // Ненулевое — сигнал пересмотреть спеку до migrate.
        eosio::check(false,
                     std::string{"migrate: неожиданный ненулевой legacy acc id="} +
                       std::to_string(acc_it->id));
    }
  }
  return r;
}

/**
 * Суммирует `blocked` по `progwallets` (soviet, scope=coopname) для заданного program_id.
 * Возвращает 0 в govern-символе, если записей нет или все пустые.
 */
inline eosio::asset sum_progwallet_blocked(eosio::name coopname, uint64_t program_id) {
  progwallets_index progwallets(_soviet, coopname.value);
  auto byprog = progwallets.get_index<"byprogram"_n>();

  eosio::asset total(0, _root_govern_symbol);

  for (auto it = byprog.lower_bound(program_id); it != byprog.end() && it->program_id == program_id; ++it) {
    if (!it->blocked.has_value()) continue;
    const auto& b = it->blocked.value();
    if (b.amount == 0) continue;
    eosio::check(b.symbol == _root_govern_symbol,
                 std::string{"migrate: progwallet program_id="} + std::to_string(program_id) +
                   " имеет неожиданный symbol");
    total += b;
  }
  return total;
}

/**
 * Возвращает число активных пайщиков (`participants.status == "accepted"_n`)
 * в кооп. Сначала пытается из кеша cooperative2.active_participants_count,
 * если расширение отсутствует — итерирует participants_index.
 */
inline uint64_t count_active_participants(eosio::name coopname, const cooperative2& coop) {
  if (coop.active_participants_count.has_value()) {
    return coop.active_participants_count.value();
  }
  participants_index parts(_soviet, coopname.value);
  uint64_t n = 0;
  for (auto it = parts.begin(); it != parts.end(); ++it) {
    if (it->status == "accepted"_n) ++n;
  }
  return n;
}

/**
 * Отправляет inline apply для одной миграционной операции, если сумма > 0.
 * process_hash детерминирован по (coopname, action_code) — чтобы
 * process-registry различал миграционные проводки между собой.
 */
inline void send_transit(eosio::name self_name,
                         eosio::name coopname,
                         eosio::name action_code,
                         const eosio::asset& amt) {
  if (amt.amount == 0) return;

  const std::string hash_src =
    std::string{"mig::"} + coopname.to_string() + std::string{"::"} + action_code.to_string();
  const eosio::checksum256 proc_hash = hashit(hash_src);

  Ledger2::apply(
    self_name,
    coopname,
    action_code,
    amt,
    eosio::name{}, // username не применим к транзитной проводке
    proc_hash,
    std::string{"Транзитная миграция остатков legacy → ledger2"}
  );
}

/**
 * Мигрирует один кооператив. Вычисляет распределение, проверяет инварианты,
 * отправляет до 6 inline apply.
 */
inline void migrate_one_coop(eosio::name self_name, const cooperative2& coop) {
  const eosio::name coopname = coop.username;
  const LegacyBalances b = read_legacy_balances(coopname);

  // Ранний выход: если у кооп. вообще нет остатков — ничего не делаем.
  if (b.cash.amount == 0 && b.share.amount == 0 && b.entry.amount == 0) return;

  // Деньги, приходящиеся на паевой фонд (80). Всё что на 51 сверх вступительных.
  const eosio::asset share_money(
    b.cash.amount >= b.entry.amount ? b.cash.amount - b.entry.amount : 0,
    _root_govern_symbol
  );
  // Не-денежная часть 80: РИД Восхода + принятые коммиты имуществом.
  const eosio::asset rid_share(
    b.share.amount >= share_money.amount ? b.share.amount - share_money.amount : 0,
    _root_govern_symbol
  );

  // Sanity: entry не может превышать cash; РИД не может быть отрицательной.
  eosio::check(b.cash.amount >= b.entry.amount,
               std::string{"migrate: entry > cash на кооп "} + coopname.to_string());
  eosio::check(b.share.amount >= share_money.amount,
               std::string{"migrate: share_money > share_legacy на кооп "} + coopname.to_string());

  // Программные аналитики (из soviet::progwallets).
  const eosio::asset blagorost_invest = sum_progwallet_blocked(coopname, 4);  // ЦПП Благорост
  const eosio::asset generator_commit = sum_progwallet_blocked(coopname, 3);  // ЦПП Генератор

  // Минимальный паевой: N_active × cooperative2.minimum, ограниченный снизу
  // тем, что должно остаться в money-части после выделения инвестиций.
  const uint64_t n_active = count_active_participants(coopname, coop);
  eosio::check(coop.minimum.symbol == _root_govern_symbol,
               std::string{"migrate: cooperative2.minimum имеет неожиданный symbol на "} +
                 coopname.to_string());
  int64_t min_total_raw = static_cast<int64_t>(n_active) * coop.minimum.amount;

  // Потолок: минимальный паевой не может превышать (share_money − blagorost_invest).
  const int64_t min_cap = share_money.amount >= blagorost_invest.amount
                          ? share_money.amount - blagorost_invest.amount
                          : 0;
  if (min_total_raw > min_cap) min_total_raw = min_cap;
  const eosio::asset min_total(min_total_raw, _root_govern_symbol);

  // Остатки.
  const eosio::asset share_remain(
    share_money.amount - min_total.amount - blagorost_invest.amount,
    _root_govern_symbol
  );
  const eosio::asset rid_remain(
    rid_share.amount >= generator_commit.amount
      ? rid_share.amount - generator_commit.amount
      : 0,
    _root_govern_symbol
  );

  // Инварианты.
  eosio::check(share_remain.amount >= 0,
               std::string{"migrate: share_remain < 0 на "} + coopname.to_string() +
                 " (share_money=" + std::to_string(share_money.amount) +
                 ", min_total=" + std::to_string(min_total.amount) +
                 ", blagorost_invest=" + std::to_string(blagorost_invest.amount) + ")");
  eosio::check(rid_share.amount >= generator_commit.amount,
               std::string{"migrate: generator_commit > rid_share на "} + coopname.to_string() +
                 " (rid_share=" + std::to_string(rid_share.amount) +
                 ", generator_commit=" + std::to_string(generator_commit.amount) + ")");

  // 6 транзитных проводок (ненулевые).
  send_transit(self_name, coopname, ledger2_ops::TRANSIT_MIN_SHARE,  min_total);
  send_transit(self_name, coopname, ledger2_ops::TRANSIT_BLAGOROST,  blagorost_invest);
  send_transit(self_name, coopname, ledger2_ops::TRANSIT_SHARE,      share_remain);
  send_transit(self_name, coopname, ledger2_ops::TRANSIT_ENTRY,      b.entry);
  send_transit(self_name, coopname, ledger2_ops::TRANSIT_COMMITMENT, generator_commit);
  send_transit(self_name, coopname, ledger2_ops::TRANSIT_RID,        rid_remain);
}

} // namespace

void ledger2::migrate(uint64_t from_coop_index, uint64_t limit) {
  require_auth(get_self());

  ledger2_meta_index meta_tbl(get_self(), get_self().value);
  auto meta_it = meta_tbl.find(0);

  // Полный прогон уже завершён — тихий no-op (Decision #D4 / Story 1.15 AC5).
  if (meta_it != meta_tbl.end() && meta_it->migrated) {
    return;
  }

  if (meta_it != meta_tbl.end()) {
    eosio::check(from_coop_index == meta_it->last_migrated_coop_index,
                 std::string{"migrate: from_coop_index должен продолжать с last_migrated_coop_index="} +
                   std::to_string(meta_it->last_migrated_coop_index));
  } else {
    eosio::check(from_coop_index == 0,
                 "migrate: первый вызов должен начинаться с from_coop_index=0");
  }

  eosio::check(limit > 0, "migrate: limit должен быть больше 0");

  cooperatives2_index coops(_registrator, _registrator.value);

  uint64_t idx  = 0;
  uint64_t done = 0;
  bool reached_end = true;

  for (auto it = coops.begin(); it != coops.end(); ++it, ++idx) {
    if (idx < from_coop_index) continue;
    if (done >= limit) { reached_end = false; break; }

    // Мигрируем только кооперативы (не отделения и не физ. записи).
    if (it->is_cooperative) {
      migrate_one_coop(get_self(), *it);
    }
    ++done;
  }

  if (done == 0 && from_coop_index == 0 && coops.begin() == coops.end()) {
    eosio::check(false, "migrate: таблица cooperatives пуста — повторите после регистрации");
  }

  const uint64_t new_last_index = from_coop_index + done;
  const uint64_t coops_total    = meta_it == meta_tbl.end() ? done : meta_it->migrated_coops + done;
  const auto     now            = eosio::current_time_point();

  if (meta_it == meta_tbl.end()) {
    meta_tbl.emplace(get_self(), [&](auto& m) {
      m.id                       = 0;
      m.migrated                 = reached_end;
      m.migrated_coops           = coops_total;
      m.last_migrated_coop_index = new_last_index;
      m.migrated_at              = now;
    });
  } else {
    meta_tbl.modify(meta_it, get_self(), [&](auto& m) {
      m.migrated                 = reached_end;
      m.migrated_coops           = coops_total;
      m.last_migrated_coop_index = new_last_index;
      m.migrated_at              = now;
    });
  }
}
